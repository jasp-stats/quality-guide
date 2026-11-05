"""Build a lightweight online guide and a complete standalone offline copy."""
from pathlib import Path
import base64
import hashlib
import html as html_text
import json
import re
import shutil

root = Path(__file__).resolve().parent


def unique_keys(pairs):
    """Catch duplicate manifest IDs instead of silently replacing an asset."""
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate key in media.json: {key}")
        result[key] = value
    return result


def build_media(analysis_ids):
    manifest = json.loads((root / "media.json").read_text(encoding="utf-8"),
                          object_pairs_hook=unique_keys)
    if not isinstance(manifest, dict) or set(manifest) != {"defaults", "analyses", "assets", "videoPlaceholder"}:
        raise ValueError("media.json requires defaults, analyses, assets, and videoPlaceholder objects.")
    if not all(isinstance(manifest[key], dict) for key in manifest):
        raise ValueError("media.json defaults, analyses, assets, and videoPlaceholder must be objects.")
    online_assets = {}
    offline_assets = {}
    media_files = {}
    asset_root = (root / "assets-source").resolve()
    placeholder = manifest["videoPlaceholder"]
    for field in ("file", "alt"):
        if not isinstance(placeholder.get(field), str) or not placeholder[field].strip():
            raise ValueError(f"Video placeholder: missing {field}.")
    if Path(placeholder["file"]).is_absolute():
        raise ValueError("Video placeholder: use a relative assets-source file path.")
    placeholder_file = (root / placeholder["file"]).resolve()
    if not placeholder_file.is_relative_to(asset_root) or not placeholder_file.is_file() or placeholder_file.suffix.lower() != ".png":
        raise ValueError("Video placeholder: expected an existing .png file inside assets-source.")
    placeholder_bytes = placeholder_file.read_bytes()
    if not placeholder_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("Video placeholder: file must contain a PNG image.")
    video_placeholder = {"src": "data:image/png;base64," + base64.b64encode(placeholder_bytes).decode("ascii"),
                         "alt": placeholder["alt"]}
    formats = {"video": (".mp4", "video/mp4"), "jasp": (".jasp", "application/octet-stream")}
    for asset_id, asset in manifest["assets"].items():
        if not asset_id or not isinstance(asset, dict) or asset.get("kind") not in formats:
            raise ValueError(f"Media asset {asset_id!r} needs a video or jasp kind.")
        for field in ("file", "title", "note"):
            if not isinstance(asset.get(field), str) or not asset[field].strip():
                raise ValueError(f"Media asset {asset_id}: missing {field}.")
        if Path(asset["file"]).is_absolute():
            raise ValueError(f"Media asset {asset_id}: use a relative assets-source file path.")
        file = (root / asset["file"]).resolve()
        suffix, mime = formats[asset["kind"]]
        if not file.is_relative_to(asset_root) or not file.is_file() or file.suffix.lower() != suffix:
            raise ValueError(f"Media asset {asset_id}: expected an existing {suffix} file inside assets-source.")
        output = {"title": asset["title"], "note": asset["note"]}
        if asset["kind"] == "jasp":
            filename = asset.get("filename")
            if not isinstance(filename, str) or Path(filename).name != filename or "\\" in filename or not filename.endswith(".jasp"):
                raise ValueError(f"Media asset {asset_id}: filename must be a plain .jasp download name.")
            output["filename"] = filename
        contents = file.read_bytes()
        media_name = hashlib.sha256(contents).hexdigest() + suffix
        online_assets[asset_id] = {**output, "src": "media/" + media_name}
        offline_assets[asset_id] = {**output, "src": f"data:{mime};base64," +
                                  base64.b64encode(contents).decode("ascii")}
        media_files[media_name] = file

    def validate_selection(selection, label, complete=False):
        if not isinstance(selection, dict) or not set(selection).issubset(formats):
            raise ValueError(f"{label}: only video and jasp asset IDs are supported.")
        if complete and set(selection) != set(formats):
            raise ValueError(f"{label}: both video and jasp defaults are required.")
        for kind, asset_id in selection.items():
            if asset_id is None:
                continue
            if not isinstance(asset_id, str) or asset_id not in online_assets or manifest["assets"][asset_id]["kind"] != kind:
                raise ValueError(f"{label}: {kind} must be null or reference an existing {kind} asset.")

    validate_selection(manifest["defaults"], "Media defaults", complete=True)
    for analysis_id, selection in manifest["analyses"].items():
        if analysis_id not in analysis_ids:
            raise ValueError(f"Media override references unknown analysis: {analysis_id}")
        validate_selection(selection, f"Media override {analysis_id}")
    common = {"defaults": manifest["defaults"], "analyses": manifest["analyses"],
              "videoPlaceholder": video_placeholder}
    return ({**common, "assets": online_assets}, {**common, "assets": offline_assets}, media_files)


analyses = {}
for name in ("qc-content.json", "method-content.json", "correlation-content.json", "classical-content.json", "survival-content.json", "acceptance-content.json"):
    addition = json.loads((root / name).read_text(encoding="utf-8"))
    assert not analyses.keys() & addition.keys(), f"Duplicate analysis ID in {name}"
    analyses.update(addition)
examples = {}
for name in ("examples.json", "correlation-examples.json", "classical-examples.json", "survival-examples.json", "acceptance-examples.json"):
    addition = json.loads((root / name).read_text(encoding="utf-8"))
    assert not examples.keys() & addition.keys(), f"Duplicate sample ID in {name}"
    examples.update(addition)
online_media, offline_media, media_files = build_media(analyses)


def embedded_asset(name, mime):
    return f"data:{mime};base64," + base64.b64encode((root / "assets-source" / name).read_bytes()).decode("ascii")


logo = embedded_asset("logo-white.svg", "image/svg+xml")
styles = (root / "style.css").read_text(encoding="utf-8")
style_assets = {
    "__ROBOTO_LIGHT__": ("fonts/Roboto-Light.ttf", "font/ttf"),
    "__ROBOTO_REGULAR__": ("fonts/Roboto-Regular.ttf", "font/ttf"),
    "__ROBOTO_BOLD__": ("fonts/Roboto-Bold.ttf", "font/ttf"),
    "__WAVE_DOWN__": ("brand/wave-down.svg", "image/svg+xml"),
    "__WAVE_HOME__": ("brand/wave-down-home.svg", "image/svg+xml"),
    "__WAVE_UP__": ("brand/wave-up.svg", "image/svg+xml"),
}
for token, (name, mime) in style_assets.items():
    count = styles.count(token)
    if count != 1 and not (token == "__WAVE_UP__" and count == 0):
        raise ValueError(f"Expected one {token} in style.css; found {count}.")
    if count:
        styles = styles.replace(token, embedded_asset(name, mime))
scripts = "\n".join((root / name).read_text(encoding="utf-8") for name in ("flow.js", "extensions-flow.js", "app.js"))
assert "</script" not in scripts.lower(), "Inline script end tag requires escaping."
page_template = (root / "shell.html").read_text(encoding="utf-8")
for key, value in {
    "__STYLES__": styles,
    "__LOGO__": logo,
    "__FOOTER_LOGO__": logo,
    "__LOGO_COLOUR__": embedded_asset("brand/logo-colour.png", "image/png"),
    "__APP__": scripts,
}.items():
    assert page_template.count(key) == 1, key
    page_template = page_template.replace(key, value)
assert page_template.count("__DATA__") == 1, "__DATA__"
font_license = (root / "assets-source" / "fonts" / "OFL.txt").read_text(encoding="utf-8")
if page_template.count("</body>") != 1:
    raise ValueError("Expected one closing body tag for the embedded font license.")
page_template = page_template.replace("</body>", '<template id="font-license"><pre>' + html_text.escape(font_license) + '</pre></template>\n</body>')


def render_page(media, delivery):
    payload = json.dumps({"analyses": analyses, "examples": examples, "media": media,
                          "delivery": delivery}, ensure_ascii=False, separators=(",", ":"))
    payload = payload.replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    html = page_template.replace("__DATA__", payload)
    unresolved = re.findall(r"__[A-Z][A-Z0-9_]*__", html)
    if unresolved:
        raise ValueError(f"Unresolved build placeholders: {', '.join(sorted(set(unresolved)))}")
    return html


out_dir = root / "dist"
media_dir = out_dir / "media"
offline_name = "JASP-Quality-Guide.html"
for directory in (out_dir, media_dir):
    if directory.is_symlink():
        raise ValueError(f"Generated directory must not be a symlink: {directory}")
    directory.mkdir(exist_ok=True)

# Own only content-hashed media files. Leave unrelated files and source assets alone.
for name, source in media_files.items():
    destination = media_dir / name
    if destination.is_symlink():
        raise ValueError(f"Generated media must not be a symlink: {destination}")
    shutil.copyfile(source, destination)
for candidate in media_dir.iterdir():
    if (re.fullmatch(r"[0-9a-f]{64}\.(mp4|jasp)", candidate.name)
            and candidate.name not in media_files and (candidate.is_file() or candidate.is_symlink())):
        candidate.unlink()

for name, media, delivery in (
    ("index.html", online_media, {"mode": "online", "offlineFile": offline_name}),
    (offline_name, offline_media, {"mode": "offline"}),
):
    out = out_dir / name
    if out.is_symlink():
        raise ValueError(f"Generated HTML must not be a symlink: {out}")
    out.write_text(render_page(media, delivery), encoding="utf-8")
    print(json.dumps({"file": str(out), "mode": delivery["mode"], "bytes": out.stat().st_size,
                      "analyses": len(analyses), "datasets": len(examples)}))
print(json.dumps({"media_files": len(media_files),
                  "media_bytes": sum(source.stat().st_size for source in media_files.values())}))

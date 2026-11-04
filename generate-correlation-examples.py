"""Deterministic synthetic datasets for the correlation teaching routes."""
from pathlib import Path
import json
import random

rng = random.Random(20261029)
rows = []
for i in range(1, 81):
    coating = rng.gauss(50, 4.5)
    roughness = 3.8 - .035 * (coating - 50) + rng.gauss(0, .34)
    strength = 160 + 1.6 * (coating - 50) - 6 * (roughness - 3.8) + rng.gauss(0, 6.8)
    rows.append([f"P{i:03d}", round(roughness, 3), round(strength, 2), round(coating, 2)])
rank_rows = []
for i in range(1, 73):
    roughness = rng.uniform(1.5, 5.2)
    score = max(1, min(5, round(1 + (roughness - 1.5) * 1.05 + rng.gauss(0, .8))))
    rank_rows.append([f"I{i:03d}", round(roughness, 3), score])
examples = {
    "correlation_pairs": {
        "id": "correlation_pairs", "family": "model",
        "title": "Surface roughness, coating, and bond strength",
        "description": "Synthetic measurements of 80 independent components; generated solely for teaching association and partial correlation.",
        "columns": ["Part", "Roughness_um", "Bond_strength_N", "Coating_um"],
        "rows": rows,
        "units": {"Roughness_um": "µm", "Bond_strength_N": "N", "Coating_um": "µm"},
        "notes": ["Every row is a different component. The example assumes independent sampling.", "Coating was included in the synthetic generating model. A partial correlation describes adjustment for its measured value; it does not establish a causal effect.", "These are illustrative observations, not results from a production study. Inspect the scatter plots in JASP."]
    },
    "correlation_ranks": {
        "id": "correlation_ranks", "family": "model",
        "title": "Roughness and ordered visual severity",
        "description": "Synthetic data on 72 different parts, combining a measured roughness with an ordered severity score from 1 to 5.",
        "columns": ["Part", "Roughness_um", "Severity_score"],
        "rows": rank_rows, "units": {"Roughness_um": "µm"},
        "notes": ["Severity is an ordered rating with ties. Numerical codes preserve the order; equal gaps between categories are not assumed by the rank correlation.", "Use Spearman's rho or Kendall's tau-b, and examine the pattern of observations. A single rank coefficient can miss a nonmonotonic relationship.", "The example describes association, not agreement between inspectors."]
    }
}
Path(__file__).with_name("correlation-examples.json").write_text(json.dumps(examples, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

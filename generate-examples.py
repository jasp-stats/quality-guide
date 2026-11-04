#!/usr/bin/env python3
"""Reproduce the JASP Quality Guide's synthetic teaching datasets.

Uses only the Python standard library. Every dataset has a separate fixed seed,
so editing one generator does not change the other examples. These are teaching
data, not observations from a real factory or evidence of process qualification.

Run: python generate-examples.py
Output: examples.json, next to this script.
"""

from collections import Counter
from itertools import product
import json
import math
from pathlib import Path
import random
import statistics


EXAMPLES = {}


def add(key, title, description, columns, rows, notes, units, family):
    EXAMPLES[key] = {
        "id": key,
        "title": title,
        "description": "Synthetic teaching data. " + description,
        "columns": columns,
        "rows": rows,
        "notes": ["Simulated with a fixed random seed; not real production data."] + notes,
        "units": units,
        "family": family,
    }


def normal(rng, mu, sd, digits=3):
    return round(rng.gauss(mu, sd), digits)


def binomial(rng, n, p):
    return sum(rng.random() < p for _ in range(n))


def poisson(rng, rate):
    threshold = math.exp(-rate)
    value, prob = -1, 1.0
    while prob > threshold:
        value += 1
        prob *= rng.random()
    return value


# CONTROL CHARTS -------------------------------------------------------------
rng = random.Random(1101)
rows = [[i, normal(rng, 500 if i <= 40 else 505, 1.6, 2)] for i in range(1, 61)]
add("individuals", "Bottle filling: one measurement per hour",
    "Sixty bottle volumes recorded in collection order; a deliberate mean shift begins at observation 41.",
    ["sequence", "fill_ml"], rows,
    ["One different bottle is sampled at each time point.",
     "Keep sequence order for an individuals and moving-range chart.",
     "The simulated shift is a teaching feature, not a statistical conclusion computed by the guide."],
    {"sequence": "collection order", "fill_ml": "mL"}, "monitor")

for key, size, seed in [("subgroups", 5, 1102), ("subgroups_large", 10, 1103)]:
    rng = random.Random(seed)
    rows = []
    for group in range(1, 26):
        mean = 10.0 + (0.045 if key == "subgroups" and group >= 21 else 0)
        rows.extend([[group, normal(rng, mean, 0.025, 4)] for _ in range(size)])
    add(key, f"Shaft diameter: {size} parts per subgroup",
        f"Twenty-five ordered subgroups, each containing {size} different shafts produced close together in time.",
        ["subgroup", "diameter_mm"], rows,
        ["These are distinct parts within each subgroup, not repeated readings of one part.",
         "Choose long-format input with diameter_mm as the measurement and subgroup as the subgroup identifier.",
         "A mean shift is introduced in subgroups 21–25." if key == "subgroups" else
         "The generator uses a constant mean and standard deviation; random samples can nevertheless produce chart signals."],
        {"subgroup": "collection order", "diameter_mm": "mm"}, "monitor")

for key, variable, seed in [("passfail", False, 1104), ("passfail_varying", True, 1105)]:
    rng = random.Random(seed)
    rows = []
    for batch in range(1, 31):
        inspected = rng.choice([60, 80, 100, 120, 160]) if variable else 100
        rejected = binomial(rng, inspected, 0.025 if batch <= 20 else 0.075)
        rows.append([batch, rejected, inspected])
    add(key, "Rejected units: " + ("varying sample sizes" if variable else "100 units per batch"),
        "Each item is classified once as conforming or nonconforming. The rejection probability increases after batch 20.",
        ["batch", "rejected", "inspected"], rows,
        ["rejected is a count of nonconforming units, not a count of individual defects.",
         "Use inspected as the denominator; do not enter percentages as rejected.",
         "A p chart accommodates these varying denominators." if variable else
         "The sample size is 100 throughout, permitting either a p chart or an np chart."],
        {"batch": "collection order", "rejected": "units", "inspected": "units"}, "monitor")

for key, variable, seed in [("defects", False, 1106), ("defects_varying", True, 1107)]:
    rng = random.Random(seed)
    rows = []
    for batch in range(1, 31):
        units = rng.choice([5, 10, 15, 20]) if variable else 10
        count = poisson(rng, units * (0.65 if batch <= 20 else 1.05))
        rows.append([batch, count, units])
    add(key, "Surface defects: " + ("varying inspected quantities" if variable else "10 panels per batch"),
        "Defects are counted on comparable panels. One panel can have several defects; the defect intensity rises after batch 20.",
        ["batch", "defects", "units_inspected"], rows,
        ["The number of defects can exceed the number of panels inspected.",
         "Each panel represents the same area and opportunity for defects.",
         "Use a u chart with units_inspected as exposure." if variable else
         "Each batch contains 10 panels, giving a constant opportunity for a c chart; a u chart is also possible."],
        {"batch": "collection order", "defects": "defects", "units_inspected": "panels"}, "monitor")


# PROCESS CAPABILITY --------------------------------------------------------
for key, mu, sd, seed, title, explanation in [
    ("cap_spread", 500, 6, 2101, "Bottle fill: too much variation",
     "The generator is centered on the target, but its spread is large relative to the specification interval."),
    ("cap_offcenter", 507, 1.6, 2102, "Bottle fill: a shifted process center",
     "The generator has modest spread, but its mean is close to the upper specification limit."),
]:
    rng = random.Random(seed)
    rows = [[i, normal(rng, mu, sd, 2)] for i in range(1, 121)]
    add(key, title, "One hundred and twenty independently generated bottle volumes in collection order.",
        ["sequence", "fill_ml"], rows,
        ["Illustrative requirements: lower specification 490 mL, upper specification 510 mL, target 500 mL.",
         explanation,
         "The data-generating mean and standard deviation are constant. Examine the realized time plot before interpreting capability.",
         "Compare this example with the other bottle-fill capability dataset; do not pool them."],
        {"sequence": "collection order", "fill_ml": "mL"}, "capability")

rng = random.Random(2103)
rows = [[i, round(rng.lognormvariate(math.log(25), 0.48), 2)] for i in range(1, 151)]
add("cap_skew", "Cycle time: a right-skewed distribution",
    "One hundred and fifty positive cycle times sampled from a lognormal distribution with median 25 seconds.",
    ["sequence", "cycle_seconds"], rows,
    ["Illustrative requirement: upper specification 60 seconds; there is no lower specification.",
     "The generator is lognormal with log-scale standard deviation 0.48. This is known only because the example is simulated.",
     "In real data, use process knowledge and fit diagnostics, especially the relevant tail, before choosing a capability distribution.",
     "Zero is a physical boundary, not an automatically imposed lower specification."],
    {"sequence": "collection order", "cycle_seconds": "s"}, "capability")


# MEASUREMENT SYSTEMS -------------------------------------------------------
rng = random.Random(3101)
rows = []
operator_offsets = {"A": 0, "B": 0.005, "C": -0.004}
for part in range(1, 11):
    true_value = 9.93 + 0.015 * (part - 1)
    for operator, offset in operator_offsets.items():
        interaction = rng.gauss(0, 0.0015)
        for trial in [1, 2]:
            rows.append([f"P{part:02d}", operator, trial,
                         normal(rng, true_value + offset + interaction, 0.0035, 4)])
add("gage", "Crossed Gauge R&R: shaft diameters",
    "Ten parts are each measured by three operators on two occasions, giving 60 readings.",
    ["part", "operator", "trial", "diameter_mm"], rows,
    ["All operators measure the same physical parts: this is a crossed design.",
     "part and operator are categorical identifiers; diameter_mm is a scale variable.",
     "The simulated measurement variation contains operator, operator-by-part, and repeatability components.",
     "In a real study, randomize measurement order and conceal previous readings where feasible."],
    {"diameter_mm": "mm", "trial": "repeat occasion"}, "measurement")

rng = random.Random(3102)
rows = []
for operator, offset in [("A", 0), ("B", 0.8), ("C", -0.6)]:
    for part in range(1, 11):
        batch_mean = rng.gauss(82, 4)
        for replicate in [1, 2]:
            rows.append([operator, f"{operator}{part:02d}", replicate,
                         normal(rng, batch_mean + offset, 0.8, 2)])
add("gage_nested", "Nested Gauge R&R: destructive strength readings",
    "Each operator receives 10 distinct homogeneous specimen batches and tests two nominally equivalent specimens from each batch.",
    ["operator", "part", "replicate", "strength_mpa"], rows,
    ["part identifies a specimen batch unique to one operator; batches are nested within operators.",
     "replicate identifies separate specimens, because the strength test destroys each specimen.",
     "Within-batch specimen equivalence is an assumption of this example. If it is false, specimen variation and measurement variation are confounded.",
     "Destructive testing alone does not determine nesting; the allocation of batches to operators does."],
    {"strength_mpa": "MPa", "replicate": "specimen within batch"}, "measurement")

rng = random.Random(3103)
rows = [[i, normal(rng, 25.004, 0.002, 4)] for i in range(1, 51)]
add("gage_type1", "Type 1 study: one length reference",
    "One operator makes 50 repeated readings of a reference whose accepted value is 25.000 mm.",
    ["repeat", "length_mm"], rows,
    ["Reference value: 25.000 mm. Illustrative total tolerance width: 0.100 mm.",
     "The generator includes a positive bias of 0.004 mm and repeatability standard deviation of 0.002 mm.",
     "This study addresses one instrument/operator/reference setting; it does not estimate between-operator reproducibility."],
    {"repeat": "reading order", "length_mm": "mm"}, "measurement")

rng = random.Random(3104)
rows = []
for part, reference in enumerate([10, 20, 30, 40, 50], 1):
    bias = 0.004 * (reference - 30)
    for _ in range(10):
        rows.append([f"R{part}", reference, normal(rng, reference + bias, 0.025, 3)])
add("linearity", "Gauge linearity: five reference lengths",
    "Ten repeated readings are obtained at each of five accepted reference lengths across the operating range.",
    ["part", "reference_mm", "measured_mm"], rows,
    ["The simulated bias changes linearly with reference value and is zero at 30 mm.",
     "reference_mm contains accepted reference values, not estimates from these repeated readings.",
     "Assess bias across the working range and inspect residual variation; do not extrapolate calibration beyond that range."],
    {"reference_mm": "mm", "measured_mm": "mm"}, "measurement")

rng = random.Random(3105)
rows = []
for part in range(1, 13):
    standard = "Fail" if part in [2, 4, 7, 10, 12] else "Pass"
    opposite = "Pass" if standard == "Fail" else "Fail"
    for operator, error_prob in [("A", 0.07), ("B", 0.13), ("C", 0.18)]:
        for trial in [1, 2]:
            rating = opposite if rng.random() < error_prob else standard
            rows.append([f"P{part:02d}", operator, trial, rating, standard])
add("agreement", "Attribute agreement: visual inspection",
    "Three inspectors classify the same 12 parts twice as Pass or Fail. A trusted reference classification is supplied.",
    ["part", "operator", "trial", "rating", "standard"], rows,
    ["part, operator, rating, and standard are categorical; trial labels the inspection occasion.",
     "Within-inspector consistency, between-inspector agreement, and agreement with standard answer different questions.",
     "The example is deliberately imperfect. Inspect the pattern of errors as well as any single agreement coefficient."],
    {"trial": "inspection occasion"}, "measurement")


# COMPARISONS ---------------------------------------------------------------
rng = random.Random(4101)
rows = [[f"I{i:03d}", normal(rng, 500.45, 2.0, 2)] for i in range(1, 61)]
add("compare_single", "Fill weight versus a 500 g target",
    "Sixty independent package weights for a one-sample mean comparison.",
    ["Item", "FillWeight"], rows,
    ["Test/reference value: 500 g.",
     "An illustrative equivalence question uses acceptable mean differences of −1 to +1 g, defined before looking at the results.",
     "The equivalence margin concerns the population mean, not acceptance limits for individual packages."],
    {"FillWeight": "g"}, "compare")

rng = random.Random(4102)
rows = []
for group, mean, sd in [("A", 10.000, 0.030), ("B", 10.035, 0.050)]:
    rows.extend([[f"{group}{i:02d}", group, normal(rng, mean, sd, 4)] for i in range(1, 31)])
add("compare_ind", "Two suppliers: independent shaft diameters",
    "Thirty different shafts from each of two suppliers, with deliberately unequal population spreads.",
    ["Part", "Group", "Measurement"], rows,
    ["No shaft occurs in both groups: these are independent samples.",
     "Measurement is in millimeters; Group and Part are categorical.",
     "For an illustrative equivalence question, use acceptable mean differences of −0.05 to +0.05 mm only if justified independently of these data.",
     "Equivalence of means does not demonstrate equal variability or equal defect rates."],
    {"Measurement": "mm"}, "compare")

rng = random.Random(4103)
rows = []
for i in range(1, 31):
    baseline = rng.gauss(45, 7)
    before = round(baseline + rng.gauss(0, 0.7), 2)
    after = round(baseline - 2.0 + rng.gauss(0, 1.5), 2)
    rows.append([f"P{i:02d}", before, after])
add("compare_paired", "Before and after: paired task completion times",
    "The same 30 test tasks are performed under the original and revised workflow.",
    ["Part", "Before", "After"], rows,
    ["Each row is one matched pair; preserve the row correspondence.",
     "Analyze within-pair differences and inspect their distribution.",
     "Illustrative equivalence margins for a mean time difference are −1 to +1 second.",
     "A real before/after study may confound the workflow change with learning, order, or time trends."],
    {"Before": "s", "After": "s"}, "compare")

rng = random.Random(4104)
rows = []
for group, mean, sd in [("A", 10.000, 0.035), ("B", 10.045, 0.035), ("C", 9.980, 0.035)]:
    rows.extend([[f"{group}{i:02d}", group, normal(rng, mean, sd, 4)] for i in range(1, 26)])
add("compare_three", "Three machines: independent shaft diameters",
    "Twenty-five different shafts are sampled from each of three machines.",
    ["Part", "Group", "Measurement"], rows,
    ["Group identifies the machine; each Part occurs only once.",
     "An omnibus comparison concerns whether all group means are equal; planned contrasts or multiplicity-adjusted comparisons answer more specific questions.",
     "The same nominal standard deviation is used in each generating population, but sample standard deviations will differ."],
    {"Measurement": "mm"}, "compare")

rng = random.Random(4105)
rows = []
for i in range(1, 25):
    item = rng.gauss(10, 0.075)
    rows.append([f"P{i:02d}", normal(rng, item, 0.020, 4),
                 normal(rng, item + 0.025, 0.020, 4),
                 normal(rng, item - 0.015, 0.020, 4)])
add("repeated_three", "Three settings: repeated readings on the same parts",
    "Twenty-four stable calibration parts are each measured under three instrument settings.",
    ["Part", "Setting_A", "Setting_B", "Setting_C"], rows,
    ["Each row represents the same part in all three columns; this is a repeated-measures design.",
     "Create one within-subject factor with three levels and assign Setting_A, Setting_B, and Setting_C to those levels.",
     "This comparison of mean settings is not a complete Gauge R&R study.",
     "In a real study, counterbalance or randomize setting order to reduce order effects."],
    {"Setting_A": "mm", "Setting_B": "mm", "Setting_C": "mm"}, "compare")

rng = random.Random(4106)
rows = [[f"I{i:03d}", "Fail" if rng.random() < 0.06 else "Pass"] for i in range(1, 121)]
add("passfail_units", "One batch: individual pass/fail results",
    "One hundred and twenty independent items each receive a single inspection outcome.",
    ["Item", "Result"], rows,
    ["Result is a two-level nominal variable.",
     "When testing a nonconformance proportion, explicitly choose Fail as the event of interest.",
     "An illustrative benchmark is a failure probability of 0.05; justify the benchmark and test direction before inspecting the outcome."],
    {}, "compare")

rng = random.Random(4107)
rows = []
for supplier, probability in [("A", 0.04), ("B", 0.12), ("C", 0.06)]:
    failures = binomial(rng, 100, probability)
    rows.extend([[supplier, "Pass", 100 - failures], [supplier, "Fail", failures]])
add("contingency", "Suppliers and inspection outcome: aggregated counts",
    "One hundred independent items are inspected from each supplier; the worksheet stores six aggregated frequency cells.",
    ["Supplier", "Result", "Count"], rows,
    ["Supplier and Result define the table; place Count in the frequency/counts field.",
     "These six rows summarize 300 items. Do not analyze the six rows as if they were six individual inspections.",
     "Inspect expected cell counts and use an appropriate exact method if needed."],
    {"Count": "items"}, "compare")


# DESIGN OF EXPERIMENTS ------------------------------------------------------
rng = random.Random(5101)
settings = list(product([-1, 1], repeat=3)) * 2
rng.shuffle(settings)
rows = []
for run, (temperature, pressure, speed) in enumerate(settings, 1):
    strength = (70 + 5 * temperature + 3 * pressure - 2 * speed
                + 2.5 * temperature * pressure - 1.5 * pressure * speed
                + rng.gauss(0, 1.2))
    rows.append([run, 170 + 10 * temperature, 3 + pressure,
                 50 + 10 * speed, round(strength, 2)])
add("factorial", "Replicated two-level factorial: bond strength",
    "A complete 2³ factorial is independently replicated twice and randomized, giving 16 experimental runs.",
    ["Run", "Temperature", "Pressure", "Speed", "Strength"], rows,
    ["Natural low/high settings: Temperature 160/180 °C; Pressure 2/4 bar; Speed 40/60 rpm.",
     "Coded values −1/+1 correspond to these low/high settings; centers are 170 °C, 3 bar, and 50 rpm.",
     "Rows with repeated settings are separate experimental runs, not repeated readings from the same run.",
     "The generating model contains main effects plus Temperature × Pressure and Pressure × Speed interactions.",
     "The randomized Run column records execution order. No center points or blocks are included."],
    {"Run": "execution order", "Temperature": "°C", "Pressure": "bar",
     "Speed": "rpm", "Strength": "MPa"}, "doe")

rng = random.Random(5102)
settings = (list(product([-1, 1], repeat=2))
            + [(-1, 0), (1, 0), (0, -1), (0, 1)] + [(0, 0)] * 5)
rng.shuffle(settings)
rows = []
for run, (temperature, time) in enumerate(settings, 1):
    response = (88 + 3 * temperature - 2 * time - 5 * temperature ** 2
                - 4 * time ** 2 + 1.5 * temperature * time + rng.gauss(0, 0.6))
    rows.append([run, 170 + 10 * temperature, 30 + 10 * time, round(response, 2)])
add("surface", "Response surface: temperature, time, and yield",
    "A two-factor face-centered central composite design has four factorial points, four axial points, and five independently replicated center runs.",
    ["Run", "Temperature", "Time", "Yield"], rows,
    ["Temperature settings: 160, 170, 180 °C. Time settings: 20, 30, 40 minutes.",
     "Coding: (Temperature − 170)/10 and (Time − 30)/10. Axial distance is 1 (face-centered).",
     "There are 13 randomized experimental runs; Yield is a continuous percentage, not a binomial count.",
     "The generating model includes both linear terms, both squared terms, and their interaction.",
     "Fit a second-order model, inspect residuals, and confirm any proposed optimum in new runs."],
    {"Run": "execution order", "Temperature": "°C", "Time": "min", "Yield": "%"}, "doe")


# DRIVERS / REGRESSION -------------------------------------------------------
rng = random.Random(6101)
rows = []
for run in range(1, 73):
    temperature = round(rng.uniform(155, 185), 1)
    pressure = round(rng.uniform(1.5, 4.5), 2)
    response = 75 + 0.35 * (temperature - 170) + 2 * (pressure - 3) + rng.gauss(0, 2)
    rows.append([run, temperature, pressure, round(response, 2)])
add("drivers", "Process drivers: continuous yield",
    "Seventy-two production observations contain temperature, pressure, and a continuous yield measurement.",
    ["Run", "Temperature", "Pressure", "Yield"], rows,
    ["Temperature spans 155–185 °C; Pressure spans 1.5–4.5 bar.",
     "Yield is a continuous percentage; no inspected-item denominator is available or implied.",
     "Use Temperature and Pressure as predictors and Yield as the response; Run is an identifier.",
     "This example illustrates association. Observational regression alone does not identify causal effects.",
     "Inspect residual patterns and influential observations; evaluate prediction on independent data."],
    {"Run": "observation identifier", "Temperature": "°C", "Pressure": "bar", "Yield": "%"}, "drivers")

rng = random.Random(6102)
rows = []
for item in range(1, 181):
    temperature = round(rng.uniform(155, 185), 1)
    pressure = round(rng.uniform(1.5, 4.5), 2)
    log_odds = -2.3 + 0.10 * (temperature - 170) - 0.55 * (pressure - 3)
    probability = 1 / (1 + math.exp(-log_odds))
    defective = int(rng.random() < probability)
    rows.append([f"I{item:03d}", temperature, pressure, defective])
add("binary_drivers", "Process drivers: probability of a defective item",
    "One hundred and eighty independently generated items have two process measurements and a binary inspection outcome.",
    ["Item", "Temperature", "Pressure", "Defective"], rows,
    ["Defective is coded 0 = conforming and 1 = defective. Set it to nominal and verify which level is modeled as the event.",
     "Temperature and Pressure are continuous predictors; Item is an identifier.",
     "A logistic model relates the predictors to event probability while keeping predictions between zero and one.",
     "A rare outcome and limited data can lead to imprecise estimates; inspect uncertainty and predictive performance."],
    {"Temperature": "°C", "Pressure": "bar", "Defective": "0/1 category"}, "drivers")


def validate():
    """Check substantive data constraints and the experimental design structure."""
    for key, example in EXAMPLES.items():
        assert key == example["id"]
        assert len(set(example["columns"])) == len(example["columns"])
        assert example["rows"]
        assert all(len(row) == len(example["columns"]) for row in example["rows"])
        assert set(example["units"]).issubset(example["columns"])
        for row in example["rows"]:
            assert all(not isinstance(value, float) or math.isfinite(value) for value in row)

    for key in ["passfail", "passfail_varying"]:
        assert all(0 <= rejected <= inspected and inspected > 0
                   for _, rejected, inspected in EXAMPLES[key]["rows"])
    for key in ["defects", "defects_varying"]:
        assert all(defects >= 0 and inspected > 0
                   for _, defects, inspected in EXAMPLES[key]["rows"])
    for key, subgroup_size in [("subgroups", 5), ("subgroups_large", 10)]:
        counts = Counter(row[0] for row in EXAMPLES[key]["rows"])
        assert len(counts) == 25 and set(counts.values()) == {subgroup_size}

    gage_counts = Counter((row[0], row[1]) for row in EXAMPLES["gage"]["rows"])
    assert len(gage_counts) == 30 and set(gage_counts.values()) == {2}
    nested_owners = {}
    for operator, part, _, _ in EXAMPLES["gage_nested"]["rows"]:
        nested_owners.setdefault(part, set()).add(operator)
    assert len(nested_owners) == 30 and all(len(owners) == 1 for owners in nested_owners.values())
    assert all(row[-1] in {"Pass", "Fail"} and row[-2] in {"Pass", "Fail"}
               for row in EXAMPLES["agreement"]["rows"])

    factorial_counts = Counter(tuple(row[1:4]) for row in EXAMPLES["factorial"]["rows"])
    assert set(factorial_counts) == set(product([160, 180], [2, 4], [40, 60]))
    assert set(factorial_counts.values()) == {2}
    surface_counts = Counter(tuple(row[1:3]) for row in EXAMPLES["surface"]["rows"])
    assert surface_counts[(170, 30)] == 5
    assert len(surface_counts) == 9
    assert all(count == (5 if point == (170, 30) else 1) for point, count in surface_counts.items())

    assert sum(row[2] for row in EXAMPLES["contingency"]["rows"]) == 300
    assert {row[1] for row in EXAMPLES["passfail_units"]["rows"]} == {"Pass", "Fail"}
    assert {row[-1] for row in EXAMPLES["binary_drivers"]["rows"]} == {0, 1}
    assert all(0 <= row[-1] <= 100 for key in ["surface", "drivers"] for row in EXAMPLES[key]["rows"])


if __name__ == "__main__":
    validate()
    path = Path(__file__).resolve().with_name("examples.json")
    path.write_text(json.dumps(EXAMPLES, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Created {path.name}: {len(EXAMPLES)} synthetic teaching datasets, "
          f"{sum(len(e['rows']) for e in EXAMPLES.values())} rows.")
    for key in ["cap_spread", "cap_offcenter"]:
        measurements = [row[1] for row in EXAMPLES[key]["rows"]]
        print(f"{key}: n={len(measurements)}, mean={statistics.mean(measurements):.3f}, "
              f"sample SD={statistics.stdev(measurements):.3f}, "
              f"outside490to510={sum(x < 490 or x > 510 for x in measurements)}")

# PY01 — Python for Scientists
## Live pilot kit · 26 October 2026

**Delivery status:** the full 8 × 90-minute teaching architecture exists; this file is a first-session teaching kit and public preview. It is **not** a completed 5–6-hour video course. Proposed launch cohort price in the existing commercial brief: 2,990 Kč per person, subject to final confirmation; no dates or paid seats have been confirmed.

**Audience:** MSc students, PhD students, postdocs and laboratory staff who understand measurements but are new to Python.
**Learner deliverable:** one notebook that imports a synthetic experiment, cleans values, compares groups, produces a labelled plot and reports uncertainty and limitations.
**Learning checks:** baseline attempt, practice notebook, capstone rerun from top to bottom, and instructor feedback.

### Eight live meetings, 90 minutes each
1. Colab/Jupyter, files, basic Python and a first dataset.
2. Functions, NumPy and scientific quantities.
3. pandas: inspect, validate and clean.
4. pandas: group, reshape and join metadata.
5. Matplotlib: readable and honest plots.
6. Statistics: questions, assumptions and effect sizes.
7. Reusable automation, file paths and reproducibility.
8. Capstone clinic, interpretation and presentation.

### Lesson 1: instructor timeline
- 0–10 min — diagnostic: how does the learner currently check 12 values in a spreadsheet?
- 10–20 min — define the workflow (raw CSV → validate → analyse → interpret).
- 20–35 min — open Google Colab or Jupyter; distinguish code, Markdown and output.
- 35–50 min — import the companion `PY01-demo.csv` via pandas, display columns, inspect types.
- 50–60 min — guided exercise: identify duplicate IDs, absent readings and unknown units.
- 60–75 min — compute n, mean and standard deviation for valid observations in each group.
- 75–85 min — produce a plot with group labels, measurement unit, axis title and caption.
- 85–90 min — feedback and homework confirmation.

### Student worksheet
The synthetic data file intentionally contains an empty measurement, a suspicious duplicate sample ID and a value reported in the wrong unit. The task is to **flag**, not silently delete or guess, problematic records.

1. Count rows and unique sample IDs. Explain the discrepancy.
2. Define a validation rule: expected unit is `AU`, and measurements must be numeric.
3. Create a separate `valid` table after documenting each exclusion.
4. Summarise values by treatment group: count, mean, SD.
5. Make a scatter or strip plot that shows individual observations, with meaningful labels.
6. Write 70–100 words distinguishing a descriptive difference from a causal conclusion.

**Starter code**
```python
import pandas as pd
from pathlib import Path

df = pd.read_csv(Path("PY01-demo.csv"))
print(df.shape)
print(df.dtypes)
print(df["sample_id"].value_counts().head())

invalid_unit = df["unit"].ne("AU")
invalid_value = pd.to_numeric(df["measurement"], errors="coerce").isna()
duplicated_id = df["sample_id"].duplicated(keep=False)
quality_report = df.assign(
    invalid_unit=invalid_unit,
    invalid_value=invalid_value,
    duplicate_id=duplicated_id,
)
print(quality_report.to_string(index=False))
```

**Homework (30 minutes):** document which rows you excluded and why, regenerate a plot and write a 5-line README so another scientist can rerun the notebook.

### Instructor answer checks
For the demo file, some records must be flagged. A defensible solution must explain whether duplicate sample IDs represent replicates or an error; do not deduplicate without metadata. Do not convert a unit labelled `mAU` without knowing its meaning in the experiment. The purpose is the reasoning and documentation, not obtaining a desired p-value.

### Quality & rights
Use only synthetic or lawfully shared training data. Do not upload confidential patient, client or unpublished collaborator data to public cloud notebooks or AI tools without prior institutional approval. Any completed analysis must be human-reviewed. No claim of research or exam success.

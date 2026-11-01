"""Check the supplied experiment without starting an interactive session."""

import importlib.util
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "python" / "verity.py"
spec = importlib.util.spec_from_file_location("verity", path)
verity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verity)

assert len(verity.df) == 150
assert verity.df["label"].value_counts().to_dict() == {0: 75, 1: 75}
assert len(verity.FEATURE_COLS) == 23
assert verity.X_train.shape == (112, 23)
assert verity.X_test.shape == (38, 23)
for model, features in [
    (verity.rf, verity.X_test),
    (verity.lr, verity.X_test_sc),
    (verity.svm, verity.X_test_sc),
]:
    probabilities = model.predict_proba(features)
    assert probabilities.shape == (38, 2)
    assert verity.np.allclose(probabilities.sum(axis=1), 1)
print("OK: 150 samples, 23 features, 3 fitted classifiers. No validity claim implied.")

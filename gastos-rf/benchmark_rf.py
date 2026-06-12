"""
benchmark_rf.py
───────────────
Finds the best *Random Forest* configuration on the current training data
(hardcoded + data/*.csv). Read-only: does NOT overwrite the saved model.
Run:  python benchmark_rf.py
"""

from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import cross_val_score
from sklearn.ensemble import RandomForestClassifier

from train import TRAINING_DATA, load_external_data


def build_dataset():
    combined: dict[str, str] = {}
    for text, label in TRAINING_DATA:
        key = text.strip().lower()
        if key:
            combined.setdefault(key, label)
    for text, label in load_external_data():
        key = text.strip().lower()
        if key and key not in combined:
            combined[key] = label
    return list(combined.keys()), list(combined.values())


def word(**kw):
    return TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True,
                           strip_accents="unicode", token_pattern=r"\b\w+\b", **kw)


def char():
    return TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1,
                           sublinear_tf=True, strip_accents="unicode")


def word_char():
    return FeatureUnion([("word", word()), ("char", char())])


def rf(**kw):
    base = dict(n_estimators=400, class_weight="balanced", random_state=42, n_jobs=-1)
    base.update(kw)
    return RandomForestClassifier(**base)


texts, labels = build_dataset()
print(f"\nDataset: {len(texts)} unique samples\n")

configs = {
    "current: word(1,2) max_feat=8000 + RF(sqrt,400)":
        Pipeline([("v", word(max_features=8000)), ("c", rf())]),
    "word(1,2) + RF(max_features=0.3, 600)":
        Pipeline([("v", word()), ("c", rf(n_estimators=600, max_features=0.3))]),
    "word+char + RF(sqrt, 400)":
        Pipeline([("v", word_char()), ("c", rf())]),
    "word+char + RF(max_features=0.2, 600)":
        Pipeline([("v", word_char()), ("c", rf(n_estimators=600, max_features=0.2))]),
    "word+char + RF(max_features=0.3, 600)":
        Pipeline([("v", word_char()), ("c", rf(n_estimators=600, max_features=0.3))]),
    "char(3,5) + RF(max_features=0.3, 600)":
        Pipeline([("v", char()), ("c", rf(n_estimators=600, max_features=0.3))]),
}

print(f"{'RF configuration':52} {'CV accuracy (5-fold)':>20}")
print("-" * 74)
for name, pipe in configs.items():
    scores = cross_val_score(pipe, texts, labels, cv=5, scoring="accuracy")
    print(f"{name:52} {scores.mean():.3f} +/- {scores.std():.3f}")

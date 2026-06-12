"""
benchmark_models.py
───────────────────
Compares candidate classifiers on the CURRENT training data (hardcoded +
data/*.csv), using the same de-dup logic as train.py. Read-only: it does NOT
overwrite model/rf_categorizer.joblib. Run:  python benchmark_models.py
"""

from collections import Counter

from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import cross_val_score
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.naive_bayes import ComplementNB

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


def word_tfidf(**kw):
    return TfidfVectorizer(
        ngram_range=(1, 2), min_df=1, sublinear_tf=True,
        strip_accents="unicode", token_pattern=r"\b\w+\b", **kw,
    )


def char_tfidf():
    # char_wb = character n-grams within word boundaries; robust to typos / unseen words
    return TfidfVectorizer(
        analyzer="char_wb", ngram_range=(3, 5), min_df=1,
        sublinear_tf=True, strip_accents="unicode",
    )


texts, labels = build_dataset()
print(f"\nDataset: {len(texts)} unique samples")
print("Classes: " + ", ".join(f"{k}={v}" for k, v in sorted(Counter(labels).items())))
print()

candidates = {
    "RandomForest (current)":
        Pipeline([("tfidf", word_tfidf()),
                  ("clf", RandomForestClassifier(n_estimators=400, class_weight="balanced",
                                                 random_state=42, n_jobs=-1))]),
    "LogisticRegression (word)":
        Pipeline([("tfidf", word_tfidf()),
                  ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", C=10))]),
    "LinearSVC (word)":
        Pipeline([("tfidf", word_tfidf()),
                  ("clf", LinearSVC(class_weight="balanced", C=1))]),
    "ComplementNB (word)":
        Pipeline([("tfidf", word_tfidf()), ("clf", ComplementNB())]),
    "LogisticRegression (char n-grams)":
        Pipeline([("tfidf", char_tfidf()),
                  ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", C=10))]),
    "LogisticRegression (word + char)":
        Pipeline([("tfidf", FeatureUnion([("word", word_tfidf()), ("char", char_tfidf())])),
                  ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", C=10))]),
}

print(f"{'Model':36} {'CV accuracy (5-fold)':>22}")
print("-" * 60)
for name, pipe in candidates.items():
    scores = cross_val_score(pipe, texts, labels, cv=5, scoring="accuracy")
    print(f"{name:36} {scores.mean():.3f} +/- {scores.std():.3f}")

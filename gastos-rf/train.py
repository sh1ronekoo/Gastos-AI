"""
train.py
────────
Trains a TF-IDF → Random Forest pipeline on labeled Philippine expense data.
Saves the model to model/rf_categorizer.joblib.

Run:
    python train.py
"""

import os
import json
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report

# ── Categories (must match ExpenseCategory in TypeScript exactly) ─────────────
CATEGORIES = ["Food", "Transport", "Utilities", "Shopping", "Health", "Other"]

# ── Labeled training data (PH-focused) ───────────────────────────────────────
# Format: (text, category)
# text = title + " " + merchant_name  (same concatenation used in categorizer.py)
TRAINING_DATA = [
    # ── Food ──────────────────────────────────────────────────────────────────
    ("jollibee burger meal jollibee sm davao", "Food"),
    ("mcdo breakfast mcdonalds", "Food"),
    ("chowking rice meal chowking", "Food"),
    ("mang inasal chicken inasal mang inasal", "Food"),
    ("greenwich pizza greenwich", "Food"),
    ("kfc chickenjoy kfc", "Food"),
    ("burger king whopper burger king", "Food"),
    ("pizza hut delivery pizza hut", "Food"),
    ("starbucks coffee starbucks ph", "Food"),
    ("bo's coffee latte bo's coffee davao", "Food"),
    ("grab food delivery grabfood", "Food"),
    ("foodpanda order foodpanda", "Food"),
    ("7-eleven snack 7-eleven", "Food"),
    ("ministop hotdog ministop", "Food"),
    ("puregold groceries puregold", "Food"),
    ("savemore supermarket savemore", "Food"),
    ("sm supermarket grocery sm supermarket", "Food"),
    ("robinsons supermarket grocery robinsons", "Food"),
    ("palengke vegetables wet market davao", "Food"),
    ("lunch at carinderia local eatery", "Food"),
    ("merienda snack", "Food"),
    ("dinner restaurant", "Food"),
    ("breakfast meal", "Food"),
    ("boba tea share tea", "Food"),
    ("shawarma stand street food", "Food"),
    ("rice chicken ulam", "Food"),
    ("sinigang pork restaurant", "Food"),
    ("adobo chicken home cooked", "Food"),
    ("pizza delivery dominos", "Food"),
    ("subway sandwich subway ph", "Food"),
    ("shakey's pizza shakey's", "Food"),
    ("wendys burger wendys ph", "Food"),
    ("coffee bean latte coffee bean", "Food"),
    ("tim hortons coffee tim hortons", "Food"),
    ("red ribbon cake red ribbon", "Food"),
    ("philippine seven convenience philippine seven corporation", "Food"),
    ("711 snack drink 7 eleven", "Food"),
    ("grocery shopping sm", "Food"),
    ("market shopping public market", "Food"),
    ("pagkain food allowance", "Food"),
    ("fishball street food vendor", "Food"),
    ("isaw barbecue streetfood", "Food"),

    # ── Transport ─────────────────────────────────────────────────────────────
    ("grab car grab ph", "Transport"),
    ("angkas motorcycle angkas", "Transport"),
    ("move it motorcycle moveit", "Transport"),
    ("joyride motor joyride ph", "Transport"),
    ("lalamove delivery lalamove", "Transport"),
    ("transportify logistics transportify", "Transport"),
    ("jeepney fare public jeep", "Transport"),
    ("tricycle fare trike davao", "Transport"),
    ("habal habal motorcycle habal", "Transport"),
    ("bus fare ohayami bus", "Transport"),
    ("lrt fare lrt manila", "Transport"),
    ("mrt commute mrt manila", "Transport"),
    ("petron gasoline petron davao", "Transport"),
    ("shell fuel shell station", "Transport"),
    ("caltex diesel caltex", "Transport"),
    ("phoenix fuel petrol phoenix fuels", "Transport"),
    ("parking fee sm mall parking", "Transport"),
    ("expressway toll nlex", "Transport"),
    ("slex toll slex", "Transport"),
    ("easytrip reload easytrip", "Transport"),
    ("autosweep reload autosweep", "Transport"),
    ("car wash auto car wash shop", "Transport"),
    ("vulcanizing tire repair vulcanizing shop", "Transport"),
    ("oil change auto shop", "Transport"),
    ("lto registration lto", "Transport"),
    ("cebu pacific flight cebu pacific", "Transport"),
    ("airasia ticket airasia ph", "Transport"),
    ("philippine airlines pal", "Transport"),
    ("uv express fare uv", "Transport"),
    ("fx ride fx terminal", "Transport"),
    ("commute fare daily commute", "Transport"),
    ("gas refill gasoline station", "Transport"),
    ("diesel fill up fuel station", "Transport"),

    # ── Utilities ─────────────────────────────────────────────────────────────
    ("meralco bill meralco", "Utilities"),
    ("electricity bill meralco davao light", "Utilities"),
    ("maynilad water bill maynilad", "Utilities"),
    ("manila water water bill manila water", "Utilities"),
    ("tubig water bill water district", "Utilities"),
    ("pldt broadband pldt", "Utilities"),
    ("globe postpaid globe telecom", "Utilities"),
    ("smart prepaid smart communications", "Utilities"),
    ("converge fiber converge ict", "Utilities"),
    ("skycable subscription skycable", "Utilities"),
    ("sky broadband internet sky broadband", "Utilities"),
    ("dito sim dito telecommunity", "Utilities"),
    ("internet bill broadband", "Utilities"),
    ("wifi subscription home internet", "Utilities"),
    ("lpg refill solane", "Utilities"),
    ("gasul refill gasul lpg", "Utilities"),
    ("solane gas solane", "Utilities"),
    ("petrolane lpg petrolane", "Utilities"),
    ("cooking gas lpg refill", "Utilities"),
    ("electric bill monthly electricity", "Utilities"),
    ("water bill monthly water", "Utilities"),
    ("association dues condo hoa", "Utilities"),
    ("condo dues monthly condo", "Utilities"),
    ("rent monthly house rent", "Utilities"),
    ("cable bill cable tv", "Utilities"),
    ("mobile data load prepaid", "Utilities"),
    ("sun cellular load sun", "Utilities"),
    ("landline bill pldt", "Utilities"),
    ("hoa dues homeowners association", "Utilities"),

    # ── Shopping ──────────────────────────────────────────────────────────────
    ("shopee online order shopee ph", "Shopping"),
    ("lazada purchase lazada ph", "Shopping"),
    ("tiktok shop order tiktok shop", "Shopping"),
    ("zalora clothes zalora ph", "Shopping"),
    ("amazon purchase amazon", "Shopping"),
    ("sm department store sm store", "Shopping"),
    ("the sm store clothing sm store davao", "Shopping"),
    ("robinsons department store robinsons", "Shopping"),
    ("bench shirt bench ph", "Shopping"),
    ("penshoppe pants penshoppe", "Shopping"),
    ("h&m clothes h&m", "Shopping"),
    ("uniqlo shirt uniqlo ph", "Shopping"),
    ("zara dress zara", "Shopping"),
    ("landmark shopping landmark makati", "Shopping"),
    ("ace hardware tools ace hardware", "Shopping"),
    ("handyman home hardware handyman", "Shopping"),
    ("watsons beauty watsons ph", "Shopping"),
    ("shoes sneakers footwear store", "Shopping"),
    ("bag handbag accessories shop", "Shopping"),
    ("laptop gadget purchase tech store", "Shopping"),
    ("phone accessories gadget shop", "Shopping"),
    ("earphone headphone electronics", "Shopping"),
    ("charger phone charger store", "Shopping"),
    ("pasalubong gifts souvenir shop", "Shopping"),
    ("online shopping purchase online store", "Shopping"),
    ("mall shopping sm mall", "Shopping"),
    ("ayala mall shopping ayala center", "Shopping"),
    ("carousell secondhand carousell ph", "Shopping"),
    ("jeans denim clothing store", "Shopping"),
    ("dress clothes fashion boutique", "Shopping"),

    # ── Health ────────────────────────────────────────────────────────────────
    ("mercury drug medicine mercury drug", "Health"),
    ("generika medicine generika pharmacy", "Health"),
    ("southstar drug pharmacy southstar drug", "Health"),
    ("the generics pharmacy medicine tgp", "Health"),
    ("rose pharmacy medicine rose pharmacy", "Health"),
    ("medicine vitamins pharmacy", "Health"),
    ("botika medicine local pharmacy", "Health"),
    ("hospital bill davao doctors hospital", "Health"),
    ("clinic consultation medical clinic", "Health"),
    ("doctor consultation physician", "Health"),
    ("check up annual physical", "Health"),
    ("laboratory test medical lab", "Health"),
    ("blood test lab test", "Health"),
    ("xray chest xray clinic", "Health"),
    ("ultrasound ob gyne", "Health"),
    ("mri scan imaging center", "Health"),
    ("ct scan hospital", "Health"),
    ("paracetamol biogesic pharmacy", "Health"),
    ("ibuprofen pain reliever drugstore", "Health"),
    ("vitamins supplement health store", "Health"),
    ("antibiotic prescription medicine", "Health"),
    ("solmux cough syrup pharmacy", "Health"),
    ("neozep cold medicine pharmacy", "Health"),
    ("gamot medicine drugstore", "Health"),
    ("gym membership anytime fitness", "Health"),
    ("fitness gym monthly", "Health"),
    ("dental checkup dentist clinic", "Health"),
    ("tooth extraction dental clinic", "Health"),
    ("eyeglass optical shop", "Health"),
    ("contact lens optical store", "Health"),
    ("haircut barbershop salon", "Health"),
    ("salon hair treatment", "Health"),
    ("spa massage relaxation spa", "Health"),
    ("massage therapy wellness center", "Health"),
    ("philhealth contribution philhealth", "Health"),
    ("hmo health card maxicare", "Health"),
    ("health insurance premium insurance co", "Health"),
    ("konsulta doctor telemed", "Health"),

    # ── Other ─────────────────────────────────────────────────────────────────
    ("netflix subscription netflix", "Other"),
    ("spotify premium spotify", "Other"),
    ("youtube premium google", "Other"),
    ("disney plus subscription disney+", "Other"),
    ("mobile legends diamonds moonton", "Other"),
    ("valorant points riot games", "Other"),
    ("steam game valve steam", "Other"),
    ("playstation game sony playstation", "Other"),
    ("sm cinema movie sm cinema davao", "Other"),
    ("cinema ticket movie house", "Other"),
    ("gcash send money gcash", "Other"),
    ("palawan padala palawan pawnshop", "Other"),
    ("lbc padala lbc", "Other"),
    ("mlhuillier remittance mlhuillier", "Other"),
    ("paymaya transfer paymaya", "Other"),
    ("send money transfer remittance", "Other"),
    ("tuition fee school university", "Other"),
    ("school supplies notebook pen", "Other"),
    ("book school book", "Other"),
    ("allowance school allowance", "Other"),
    ("church offering sunday mass", "Other"),
    ("tithe offering church donation", "Other"),
    ("charity donation ngo", "Other"),
    ("birthday gift celebration", "Other"),
    ("party celebration event", "Other"),
    ("miscellaneous misc expense", "Other"),
    ("gaming load codashop", "Other"),
    ("gaming pc game online shop", "Other"),
    ("event ticket concert venue", "Other"),
    ("gift souvenir pasalubong", "Other"),
    ("donation fund drive", "Other"),
]


def build_combined_text(samples):
    """Return list of raw text strings from (text, label) tuples."""
    return [text for text, _ in samples]


def train():
    texts = build_combined_text(TRAINING_DATA)
    labels = [label for _, label in TRAINING_DATA]

    # ── TF-IDF + Random Forest pipeline ──────────────────────────────────────
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 3),       # unigrams, bigrams, trigrams
            min_df=1,
            max_features=5000,
            sublinear_tf=True,        # log normalization (handles frequency skew)
            analyzer="word",
        )),
        ("rf", RandomForestClassifier(
            n_estimators=300,         # more trees = more stable probabilities
            max_depth=None,           # let trees grow fully on small dataset
            min_samples_split=2,
            min_samples_leaf=1,
            class_weight="balanced",  # handles category imbalance
            random_state=42,
            n_jobs=-1,
        )),
    ])

    # ── Cross-validation score ────────────────────────────────────────────────
    print("Running 5-fold cross-validation…")
    cv_scores = cross_val_score(pipeline, texts, labels, cv=5, scoring="accuracy")
    print(f"  CV accuracy: {cv_scores.mean():.3f} ± {cv_scores.std():.3f}")

    # ── Train on full dataset ─────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.15, random_state=42, stratify=labels
    )
    pipeline.fit(X_train, y_train)

    # ── Evaluation ────────────────────────────────────────────────────────────
    y_pred = pipeline.predict(X_test)
    print("\nClassification report (held-out 15%):")
    print(classification_report(y_test, y_pred, target_names=CATEGORIES))

    # ── Feature importances (top 20) ─────────────────────────────────────────
    rf = pipeline.named_steps["rf"]
    tfidf = pipeline.named_steps["tfidf"]
    feature_names = tfidf.get_feature_names_out()
    importances = rf.feature_importances_
    top_idx = np.argsort(importances)[::-1][:20]
    print("\nTop 20 most important features:")
    for i, idx in enumerate(top_idx):
        print(f"  {i+1:2}. {feature_names[idx]:<30} {importances[idx]:.4f}")

    # ── Save model ────────────────────────────────────────────────────────────
    os.makedirs("model", exist_ok=True)
    model_path = os.path.join("model", "rf_categorizer.joblib")
    joblib.dump(pipeline, model_path)
    print(f"\nModel saved → {model_path}")

    # Save category list alongside model (for validation in API)
    meta_path = os.path.join("model", "categories.json")
    with open(meta_path, "w") as f:
        json.dump({"categories": CATEGORIES}, f)
    print(f"Metadata saved → {meta_path}")

    return pipeline


if __name__ == "__main__":
    train()
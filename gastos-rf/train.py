"""
train.py
────────
Trains a TF-IDF → Random Forest pipeline on labeled Philippine expense data.
Saves the model to model/rf_categorizer.joblib.

Data sources (merged automatically):
  1. TRAINING_DATA  — hardcoded PH-focused samples below
  2. data/supplementary.jsonl  — user corrections appended by /retrain endpoint
  3. data/supabase_export.jsonl — real user expenses exported by data/fetch_supabase.py

Run:
    python train.py
"""

import os
import csv as _csv
import json
import joblib
import numpy as np
from collections import Counter
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report

# ── Categories (must match ExpenseCategory in TypeScript exactly) ─────────────
CATEGORIES = ["Food", "Transport", "Utilities", "Shopping", "Health", "Other"]

DATA_DIR = Path(__file__).parent / "data"

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
    # New Food samples
    ("gong cha milk tea gong cha", "Food"),
    ("macao imperial tea macao imperial", "Food"),
    ("chatime milk tea chatime", "Food"),
    ("tiger sugar boba tiger sugar", "Food"),
    ("coco fresh tea coco", "Food"),
    ("goldilocks cake goldilocks bakery", "Food"),
    ("red ribbon birthday cake red ribbon", "Food"),
    ("julie's bakeshop bread julies", "Food"),
    ("pan de sal bakery local bakeshop", "Food"),
    ("mary grace cafe mary grace", "Food"),
    ("figaro coffee figaro", "Food"),
    ("tropical hut burger tropical hut", "Food"),
    ("angel's burger burger stand", "Food"),
    ("potato corner fries potato corner", "Food"),
    ("inasal chicken paborito", "Food"),
    ("pork bbq barbecue restaurant", "Food"),
    ("lechon baboy litson", "Food"),
    ("bulalo soup restaurant", "Food"),
    ("kare kare ox tripe restaurant", "Food"),
    ("halo halo dessert dessert shop", "Food"),
    ("mais con yelo dessert", "Food"),
    ("taho vendor street taho", "Food"),
    ("balut vendor night market", "Food"),
    ("kwek kwek street food", "Food"),
    ("pizza express pizza express davao", "Food"),
    ("family mart convenience store", "Food"),
    ("ok convenience convenience store", "Food"),
    ("ever supermarket ever grocery", "Food"),
    ("aldi grocery aldi", "Food"),
    ("waltermart grocery waltermart", "Food"),
    ("new farmer's market grocery", "Food"),
    ("super 8 grocery super 8", "Food"),
    ("s&r membership shopping snr", "Food"),
    ("costco grocery costco", "Food"),

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
    # New Transport samples
    ("grab express delivery grab", "Transport"),
    ("taxi fare yellow cab taxi", "Transport"),
    ("metered taxi taxi davao", "Transport"),
    ("grab taxi grab ph", "Transport"),
    ("pedicab fare pedicab", "Transport"),
    ("boat ferry roro ferry line", "Transport"),
    ("ferry ticket 2go travel", "Transport"),
    ("supercat ferry supercat", "Transport"),
    ("oceanjet ferry oceanjet", "Transport"),
    ("van for hire van hire", "Transport"),
    ("tnvs ride tnvs operator", "Transport"),
    ("car rental transport rental", "Transport"),
    ("car service professional driver", "Transport"),
    ("srt train srt davao", "Transport"),
    ("fuel reload fuel refill", "Transport"),
    ("total gasoline total gas davao", "Transport"),
    ("seaoil fuel seaoil", "Transport"),
    ("unioil fuel unioil", "Transport"),
    ("mc battery battery replacement shop", "Transport"),
    ("car maintenance mechanic shop", "Transport"),
    ("toll fee skyway", "Transport"),
    ("skyway toll skyway", "Transport"),
    ("cala expressway toll cavite laguna", "Transport"),
    ("grab pabili delivery grab", "Transport"),
    ("mabuhay miles air miles", "Transport"),

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
    # New Utilities samples
    ("netflix monthly subscription netflix", "Utilities"),
    ("spotify premium monthly spotify", "Utilities"),
    ("youtube premium subscription google", "Utilities"),
    ("disney plus monthly disney+", "Utilities"),
    ("apple music subscription apple", "Utilities"),
    ("amazon prime membership amazon", "Utilities"),
    ("icloud storage apple icloud", "Utilities"),
    ("google one storage google", "Utilities"),
    ("microsoft 365 subscription microsoft", "Utilities"),
    ("adobe creative cloud subscription adobe", "Utilities"),
    ("canva pro monthly canva", "Utilities"),
    ("zoom subscription zoom", "Utilities"),
    ("meralco online payment electricity", "Utilities"),
    ("davao light electricity bill davao light", "Utilities"),
    ("benguet electric cooperative electricity", "Utilities"),
    ("globe at home wifi globe", "Utilities"),
    ("smart home wifi smart", "Utilities"),
    ("globe fiber subscription globe", "Utilities"),
    ("converge monthly broadband converge", "Utilities"),
    ("room rental boarding house", "Utilities"),
    ("dorm fee dormitory monthly", "Utilities"),
    ("condo association fee condo management", "Utilities"),
    ("water district monthly bill", "Utilities"),

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
    # New Shopping samples
    ("ikea furniture ikea", "Shopping"),
    ("home furniture store living room set", "Shopping"),
    ("wilcon depot hardware wilcon", "Shopping"),
    ("true value hardware true value", "Shopping"),
    ("home depot tools hardware store", "Shopping"),
    ("abenson appliance abenson", "Shopping"),
    ("sm appliance center ref washing machine", "Shopping"),
    ("anson's appliance store ansons", "Shopping"),
    ("cd r king gadget cdrkng", "Shopping"),
    ("octagon computer laptop octagon", "Shopping"),
    ("silicon valley gadget silicon valley", "Shopping"),
    ("istore apple istore", "Shopping"),
    ("digistore mac laptop digistore", "Shopping"),
    ("samsung phone samsung store", "Shopping"),
    ("secondhand ref furniture ukay", "Shopping"),
    ("ukay ukay thrift shop", "Shopping"),
    ("divisoria shopping divisoria manila", "Shopping"),
    ("tiangge bazaar items", "Shopping"),
    ("forever 21 fashion forever 21", "Shopping"),
    ("cotton on clothes cotton on", "Shopping"),
    ("bershka fashion bershka", "Shopping"),
    ("pull and bear clothes pull bear", "Shopping"),
    ("nike shoes nike ph", "Shopping"),
    ("adidas sneakers adidas", "Shopping"),
    ("new balance shoes new balance", "Shopping"),
    ("converse shoes converse", "Shopping"),
    ("watch accessories watch shop", "Shopping"),
    ("perfume fragrance shop", "Shopping"),
    ("cosmetics makeup beauty store", "Shopping"),
    ("national bookstore school supplies nbs", "Shopping"),

    # ── Health ────────────────────────────────────────────────────────────────
    ("mercury drug medicine mercury drug", "Health"),
    ("generika medicine generika pharmacy", "Health"),
    ("southstar drug pharmacy southstar drug", "Health"),
    ("the generics pharmacy medicine tgp", "Health"),
    ("rose pharmacy medicine rose pharmacy", "Health"),
    ("medicine vitamins pharmacy", "Health"),
    ("botika medicine local pharmacy", "Health"),
    ("hospital bill davao doctors hospital", "Health"),
    ("hospital", "Health"),
    ("hospital bill", "Health"),
    ("hospital expense", "Health"),
    ("hospital payment", "Health"),
    ("hospital fee", "Health"),
    ("davao doctors hospital", "Health"),
    ("the medical city", "Health"),
    ("st lukes hospital", "Health"),
    ("makati medical", "Health"),
    ("world citi hospital", "Health"),
    ("capitol medical center", "Health"),
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
    # New Health samples
    ("pedia consultation pediatrician", "Health"),
    ("ob gyne consultation obstetrician", "Health"),
    ("eye clinic ophthalmologist", "Health"),
    ("orthodontist braces dental", "Health"),
    ("tooth cleaning prophylaxis dental", "Health"),
    ("root canal endodontic treatment", "Health"),
    ("medical certificate clinic", "Health"),
    ("covid antigen test swab test", "Health"),
    ("pcr test covid test", "Health"),
    ("rapid antigen test pharmacy", "Health"),
    ("drug test urine test clinic", "Health"),
    ("physical therapy rehabilitation clinic", "Health"),
    ("chiropractor chiropractic session", "Health"),
    ("acupuncture wellness traditional", "Health"),
    ("medgrocer online pharmacy medgrocer", "Health"),
    ("pharmacy plus medicine store", "Health"),
    ("ritemed generic medicine ritemed", "Health"),
    ("metroplus pharmacy medicine", "Health"),
    ("celerio pharmacy cebu pharmacy", "Health"),
    ("skin care dermatologist clinic", "Health"),
    ("botox filler aesthetic clinic", "Health"),
    ("laser hair removal aesthetic center", "Health"),
    ("facial beauty salon", "Health"),
    ("nail salon manicure pedicure", "Health"),
    ("sss monthly contribution sss", "Health"),
    ("pagibig contribution pagibig", "Health"),
    ("maxicare hmo premium maxicare", "Health"),
    ("intellicare hmo intellicare", "Health"),
    ("medicard health card medicard", "Health"),
    ("yoga class yoga studio", "Health"),
    ("crossfit gym crossfit box", "Health"),
    ("muay thai gym martial arts", "Health"),

    # ── Other ─────────────────────────────────────────────────────────────────
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
    # New Other samples
    ("mobile data e-load e-load", "Other"),
    ("genshin impact topup mihoyo", "Other"),
    ("free fire diamonds codashop garena", "Other"),
    ("roblox robux roblox", "Other"),
    ("xbox game pass microsoft xbox", "Other"),
    ("nintendo switch game nintendo", "Other"),
    ("sega game sega", "Other"),
    ("mineski gaming internet cafe", "Other"),
    ("net cafe gaming internet cafe", "Other"),
    ("bgc concert events venue bgc", "Other"),
    ("kpop merchandise kpop fan shop", "Other"),
    ("concert ticket live nation", "Other"),
    ("theater ticket cultural center", "Other"),
    ("museum ticket national museum", "Other"),
    ("theme park entrance enchanted kingdom", "Other"),
    ("zoo entrance manila zoo", "Other"),
    ("swimming entrance pool fee", "Other"),
    ("bowling bowling alley", "Other"),
    ("billiards pool hall", "Other"),
    ("tuition university ateneo", "Other"),
    ("tuition review center bar review", "Other"),
    ("college fees enrollment fee", "Other"),
    ("school project materials school", "Other"),
    ("yearbook school yearbook", "Other"),
    ("graduation fee commencement", "Other"),
    ("ched scholarship application", "Other"),
    ("western union remittance western union", "Other"),
    ("cebuana lhuillier remittance cebuana", "Other"),
    ("bayad center bills payment bayad", "Other"),
    ("m lhuillier remittance mlhuillier", "Other"),
    ("pet food pet supplies pet shop", "Other"),
    ("veterinary vet clinic pet", "Other"),
    ("pet grooming grooming salon", "Other"),
    ("plant purchase garden center", "Other"),
    ("house repair contractor renovation", "Other"),
    ("paint hardware painting supplies", "Other"),
]


# ── Text combiner (mirrors _combine_inputs in categorizer.py) ─────────────────

def combine_text(title: str, merchant: str = "") -> str:
    """
    Build the training text from a title + optional merchant, the SAME way
    categorizer.py::_combine_inputs does at inference time (merchant repeated
    for ~2x weight). Keeping these in sync means the model trains on the same
    text shape it will see in production.
    """
    title_clean    = (title or "").strip().lower()
    merchant_clean = (merchant or "").strip().lower()
    if merchant_clean:
        return f"{title_clean} {merchant_clean} {merchant_clean}"
    return title_clean


# ── External data loader ──────────────────────────────────────────────────────

def load_external_data() -> list[tuple[str, str]]:
    """
    Load supplementary training samples from JSONL and CSV files, de-duplicated
    by lowercased text. Returns a list of (text, category) tuples.

    JSONL sources (each line: {"text": "...", "category": "..."}):
      data/supplementary.jsonl   — user corrections appended by /retrain endpoint
      data/supabase_export.jsonl — exported from Supabase by fetch_supabase.py

    CSV sources (columns: Title, [Merchant,] Category):
      data/GASTOS_AI_10000_Clean_Dataset.csv — PH expense samples
    """
    samples: list[tuple[str, str]] = []
    text_to_cat: dict[str, str] = {}
    conflicts = 0

    def add(text: str, category: str) -> str:
        """Returns 'added' | 'dupe' | 'conflict' | 'skip'."""
        nonlocal conflicts
        text = text.strip()
        if not text or category not in CATEGORIES:
            return "skip"
        if text in text_to_cat:
            if text_to_cat[text] != category:
                conflicts += 1
                return "conflict"
            return "dupe"
        text_to_cat[text] = category
        samples.append((text, category))
        return "added"

    # ── JSONL sources ─────────────────────────────────────────────────────────
    for path in (DATA_DIR / "supplementary.jsonl", DATA_DIR / "supabase_export.jsonl"):
        if not path.exists():
            continue
        added = dupes = skipped = 0
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    skipped += 1
                    continue
                res = add(combine_text(obj.get("text", "")),
                          (obj.get("category") or "").strip())
                if   res == "added": added += 1
                elif res == "dupe":  dupes += 1
                else:                skipped += 1
        print(f"  [{path.name}] {added} unique"
              + (f", {dupes} duplicates dropped" if dupes else "")
              + (f", {skipped} skipped" if skipped else ""))

    # ── CSV sources (columns: Title, optional Merchant, Category) ──────────────
    # Auto-discover every *.csv in data/ so new datasets just need to be dropped in.
    for path in sorted(DATA_DIR.glob("*.csv")):
        rows = added = dupes = skipped = 0
        with open(path, encoding="utf-8") as f:
            reader = _csv.DictReader(f)
            for row in reader:
                rows += 1
                text = combine_text(row.get("Title", ""), row.get("Merchant", ""))
                res = add(text, (row.get("Category") or "").strip())
                if   res == "added": added += 1
                elif res == "dupe":  dupes += 1
                else:                skipped += 1
        print(f"  [{path.name}] {rows} rows -> {added} unique "
              f"({dupes} duplicates dropped"
              + (f", {skipped} skipped" if skipped else "") + ")")

    if conflicts:
        print(f"  WARNING: {conflicts} rows had a text already labeled "
              f"differently (kept the first label)")

    return samples


# ── Training ──────────────────────────────────────────────────────────────────

def train():
    print("Loading training data...")

    external = load_external_data()

    # ── Merge hardcoded + external, de-duplicate globally by lowercased text ──
    # Exact duplicates are dropped so the same phrase can't land in both the
    # train and test split below. (The old pipeline kept ~82% duplicate CSV
    # rows and split randomly, which leaked memorized rows into the held-out set
    # and inflated the reported accuracy to a meaningless 1.00.)
    # Note: the TF-IDF vectorizer lowercases anyway, so the old CAPS / de-hyphen
    # augmentation produced feature-identical rows — it was pure duplication and
    # has been removed.
    combined: dict[str, str] = {}
    for text, label in TRAINING_DATA:
        key = text.strip().lower()
        if key:
            combined.setdefault(key, label)
    hardcoded_unique = len(combined)

    ext_added = 0
    for text, label in external:
        key = text.strip().lower()
        if key and key not in combined:
            combined[key] = label
            ext_added += 1

    texts  = list(combined.keys())
    labels = list(combined.values())

    dist = Counter(labels)
    print(f"  Hardcoded (unique)        : {hardcoded_unique}")
    print(f"  External added (new)      : {ext_added}")
    print(f"  Total unique training set : {len(texts)}")
    print("  Class distribution        : "
          + ", ".join(f"{c}={dist.get(c, 0)}" for c in CATEGORIES))

    # ── TF-IDF + Random Forest pipeline ──────────────────────────────────────
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 3),
            min_df=1,
            max_features=8000,          # increased to handle larger vocabulary
            sublinear_tf=True,
            analyzer="word",
            strip_accents="unicode",    # normalize Filipino diacritics (e.g. "ñ")
            token_pattern=r"\b\w+\b",   # include digits/alphanumeric (e.g. "7-eleven" tokens)
        )),
        ("rf", RandomForestClassifier(
            n_estimators=400,           # more trees for the larger dataset
            max_depth=None,
            min_samples_split=2,
            min_samples_leaf=1,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )),
    ])

    # ── Cross-validation score (on de-duplicated data) ───────────────────────
    print("\nRunning 5-fold cross-validation...")
    cv_scores = cross_val_score(pipeline, texts, labels, cv=5, scoring="accuracy")
    print(f"  CV accuracy: {cv_scores.mean():.3f} +/- {cv_scores.std():.3f}")

    # ── Train on full dataset ─────────────────────────────────────────────────
    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.15, random_state=42, stratify=labels
    )
    pipeline.fit(X_train, y_train)

    # ── Evaluation (leakage-free: no duplicate text spans the split) ──────────
    y_pred = pipeline.predict(X_test)
    print("\nClassification report (held-out 15%, leakage-free):")
    # labels= pins the row order to CATEGORIES; without it classification_report
    # sorts labels alphabetically and the target_names would mislabel the rows.
    print(classification_report(
        y_test, y_pred, labels=CATEGORIES, target_names=CATEGORIES, zero_division=0
    ))

    # ── Feature importances (top 20) ─────────────────────────────────────────
    rf      = pipeline.named_steps["rf"]
    tfidf   = pipeline.named_steps["tfidf"]
    feature_names = tfidf.get_feature_names_out()
    importances   = rf.feature_importances_
    top_idx = np.argsort(importances)[::-1][:20]
    print("\nTop 20 most important features:")
    for i, idx in enumerate(top_idx):
        print(f"  {i+1:2}. {feature_names[idx]:<30} {importances[idx]:.4f}")

    # ── Save model ────────────────────────────────────────────────────────────
    os.makedirs("model", exist_ok=True)
    model_path = os.path.join("model", "rf_categorizer.joblib")
    joblib.dump(pipeline, model_path)
    print(f"\nModel saved -> {model_path}")

    meta_path = os.path.join("model", "categories.json")
    with open(meta_path, "w") as f:
        json.dump({"categories": CATEGORIES}, f)
    print(f"Metadata saved -> {meta_path}")

    return pipeline


if __name__ == "__main__":
    train()

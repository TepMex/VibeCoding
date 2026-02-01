from functools import lru_cache
from typing import Iterable, Set

try:
    from nltk.stem import WordNetLemmatizer
    import nltk
except Exception:  # pragma: no cover - best effort import
    WordNetLemmatizer = None
    nltk = None

try:
    from lemminflect import getAllInflections
except Exception as exc:  # pragma: no cover - required dependency
    raise ImportError("lemminflect is required for English morphology") from exc


_LEMMATIZER = WordNetLemmatizer() if WordNetLemmatizer else None


def _wordnet_available() -> bool:
    if not nltk:
        return False
    try:
        nltk.data.find("corpora/wordnet")
        return True
    except LookupError:
        return False


@lru_cache(maxsize=100000)
def lemmatize_variants(word: str) -> Set[str]:
    if not _LEMMATIZER or not _wordnet_available():
        return {word}
    lemmas = {word}
    for pos in ("n", "v", "a", "r"):
        lemma = _LEMMATIZER.lemmatize(word, pos=pos)
        if lemma:
            lemmas.add(lemma)
    return lemmas


@lru_cache(maxsize=100000)
def generate_inflections(word: str) -> Set[str]:
    inflections: Set[str] = set()
    for lemma in lemmatize_variants(word):
        inflections.add(lemma)
        all_inflections = getAllInflections(lemma)
        for forms in all_inflections.values():
            inflections.update(forms)
    return inflections


def encode_suffix_variants(
    lemma: str,
    forms: Iterable[str],
    *,
    drop_non_prefix: bool = False,
) -> Set[str]:
    encoded: Set[str] = set()
    for form in forms:
        if form == lemma:
            encoded.add(lemma)
        elif form.startswith(lemma):
            suffix = form[len(lemma) :]
            encoded.add(f"{lemma}#{suffix}" if suffix else lemma)
        elif not drop_non_prefix:
            encoded.add(form)
    return encoded

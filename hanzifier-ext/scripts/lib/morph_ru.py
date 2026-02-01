from functools import lru_cache
from typing import Iterable, Set, Tuple

try:
    import pymorphy2
except Exception as exc:  # pragma: no cover - required dependency
    raise ImportError("pymorphy2 is required for Russian morphology") from exc


_MORPH = pymorphy2.MorphAnalyzer()


@lru_cache(maxsize=200000)
def get_lemma(word: str) -> str:
    parsed = _MORPH.parse(word)
    if not parsed:
        return word
    return parsed[0].normal_form or word


@lru_cache(maxsize=200000)
def generate_lexeme_forms(word: str) -> Tuple[str, Set[str]]:
    parsed = _MORPH.parse(word)
    if not parsed:
        return word, {word}
    best = parsed[0]
    lemma = best.normal_form or word
    forms = {lemma}
    for form in best.lexeme:
        if form.word:
            forms.add(form.word)
    return lemma, forms


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

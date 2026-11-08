"""Tests for sidecar subtitle matching."""
import os
import sys

# Add server directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from lf.core import SubtitleIndex


def _sidecar(name: str, folder: str) -> dict:
    return {
        "kind": "sidecar",
        "full": f"{folder}/{name}",
        "name": name,
        "lang": "",
        "keys": [],
        "id": name,
        "ext": "SRT",
        "upload_id": "",
        "stem": os.path.splitext(name)[0].lower(),
    }


def test_alien_does_not_match_alien2():
    subs = SubtitleIndex()
    folder = "/movies"
    subs.entries = [_sidecar("Alien 2.srt", folder)]
    movie = {
        "title": "Alien",
        "year": 1979,
        "name": "Alien",
        "full": f"{folder}/Alien.mkv",
        "id": "abc",
        "folder": "",
    }
    assert subs.match(movie) == [], "Alien 2.srt should not match Alien.mkv"


def test_alien2_matches_alien2():
    subs = SubtitleIndex()
    folder = "/movies"
    subs.entries = [_sidecar("Alien 2.srt", folder)]
    movie = {
        "title": "Alien 2",
        "year": 1986,
        "name": "Alien 2",
        "full": f"{folder}/Alien 2.mkv",
        "id": "def",
        "folder": "",
    }
    assert len(subs.match(movie)) == 1


def test_lang_suffix_sidecar():
    subs = SubtitleIndex()
    folder = "/movies"
    subs.entries = [_sidecar("Inception.en.srt", folder)]
    movie = {
        "title": "Inception",
        "year": 2010,
        "name": "Inception",
        "full": f"{folder}/Inception.mkv",
        "id": "ghi",
        "folder": "",
    }
    assert len(subs.match(movie)) == 1


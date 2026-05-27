import json
import pytest
from pathlib import Path

from builder.commands.list_brains import run
from builder.scaffolder import REQUIRED_FILES


class Args:
    def __init__(self, dest=None):
        self.dest = dest


def _make_brain(path: Path, placeholder_files: int = 0) -> None:
    path.mkdir(parents=True)
    for i, name in enumerate(REQUIRED_FILES):
        if i < placeholder_files:
            # JSON placeholders go inside string values so the file stays valid JSON
            if name == "03-evals.json":
                content = json.dumps({
                    "service": "REPLACE WITH the service definition",
                    "version": "1.0",
                    "evals": [],
                })
            else:
                content = f"REPLACE WITH content for {name}"
        else:
            if name == "03-evals.json":
                content = json.dumps({"service": "test", "version": "1.0", "evals": []})
            else:
                content = f"# Real content for {name}"
        (path / name).write_text(content)


def test_list_empty_directory_prints_header(tmp_path, capsys):
    brains = tmp_path / "brains"
    brains.mkdir()
    run(Args(dest=str(brains)))
    out = capsys.readouterr().out
    assert "NAME" in out
    assert "STATUS" in out


def test_list_missing_directory_is_graceful(tmp_path, capsys):
    result = run(Args(dest=str(tmp_path / "nonexistent")))
    assert result == 0


def test_list_shows_ready_brain(tmp_path, capsys):
    brains = tmp_path / "brains"
    _make_brain(brains / "billing-support-brain", placeholder_files=0)
    run(Args(dest=str(brains)))
    out = capsys.readouterr().out
    assert "billing-support" in out
    assert "ready" in out


def test_list_shows_in_formation(tmp_path, capsys):
    brains = tmp_path / "brains"
    # Some files filled, some still have placeholders
    _make_brain(brains / "billing-support-brain", placeholder_files=4)
    run(Args(dest=str(brains)))
    out = capsys.readouterr().out
    assert "in formation" in out


def test_list_shows_not_started(tmp_path, capsys):
    brains = tmp_path / "brains"
    # All files still have placeholders (fresh init, nothing filled)
    _make_brain(brains / "billing-support-brain", placeholder_files=len(REQUIRED_FILES))
    run(Args(dest=str(brains)))
    out = capsys.readouterr().out
    assert "not started" in out


def test_list_shows_correct_file_count(tmp_path, capsys):
    brains = tmp_path / "brains"
    brain = brains / "billing-support-brain"
    _make_brain(brain, placeholder_files=0)
    # Remove one file
    (brain / "04-skills.md").unlink()
    run(Args(dest=str(brains)))
    out = capsys.readouterr().out
    assert "8/9" in out


def test_list_counts_placeholders(tmp_path, capsys):
    brains = tmp_path / "brains"
    _make_brain(brains / "billing-support-brain", placeholder_files=3)
    run(Args(dest=str(brains)))
    out = capsys.readouterr().out
    # 3 files each have 1 "REPLACE WITH" marker
    assert "3" in out


def test_list_ignores_non_brain_dirs(tmp_path, capsys):
    brains = tmp_path / "brains"
    (brains / "not-a-brain").mkdir(parents=True)
    _make_brain(brains / "real-service-brain", placeholder_files=0)
    run(Args(dest=str(brains)))
    out = capsys.readouterr().out
    assert "not-a-brain" not in out
    assert "real-service" in out


def test_list_strips_brain_suffix_from_name(tmp_path, capsys):
    brains = tmp_path / "brains"
    _make_brain(brains / "my-service-brain", placeholder_files=0)
    run(Args(dest=str(brains)))
    out = capsys.readouterr().out
    assert "my-service" in out
    assert "my-service-brain" not in out


def test_list_multiple_brains(tmp_path, capsys):
    brains = tmp_path / "brains"
    _make_brain(brains / "billing-support-brain", placeholder_files=0)
    _make_brain(brains / "invoice-review-brain", placeholder_files=5)
    run(Args(dest=str(brains)))
    out = capsys.readouterr().out
    assert "billing-support" in out
    assert "invoice-review" in out

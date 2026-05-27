import json
import pytest
from pathlib import Path

from builder.commands.validate import run
from builder.scaffolder import REQUIRED_FILES


class Args:
    def __init__(self, name, dest=None):
        self.name = name
        self.dest = dest


def _make_valid_brain(path: Path) -> None:
    path.mkdir(parents=True)
    for name in REQUIRED_FILES:
        if name == "03-evals.json":
            (path / name).write_text(json.dumps({
                "service": "Test service definition",
                "version": "1.0",
                "evals": [
                    {"id": "EVAL-001", "description": "routine case", "difficulty": "routine"},
                ],
            }))
        else:
            (path / name).write_text(f"# Valid content for {name}\n\nNo placeholders here.")


def test_validate_passes_for_valid_brain(tmp_path):
    brain = tmp_path / "test-service-brain"
    _make_valid_brain(brain)
    assert run(Args("test-service", dest=str(tmp_path))) == 0


def test_validate_missing_file_fails(tmp_path):
    brain = tmp_path / "test-service-brain"
    _make_valid_brain(brain)
    (brain / "04-skills.md").unlink()
    assert run(Args("test-service", dest=str(tmp_path))) == 1


def test_validate_empty_file_fails(tmp_path):
    brain = tmp_path / "test-service-brain"
    _make_valid_brain(brain)
    (brain / "04-skills.md").write_text("")
    assert run(Args("test-service", dest=str(tmp_path))) == 1


def test_validate_placeholder_fails(tmp_path):
    brain = tmp_path / "test-service-brain"
    _make_valid_brain(brain)
    (brain / "01-service-definition.md").write_text("REPLACE WITH something real")
    assert run(Args("test-service", dest=str(tmp_path))) == 1


def test_validate_invalid_json_fails(tmp_path):
    brain = tmp_path / "test-service-brain"
    _make_valid_brain(brain)
    (brain / "03-evals.json").write_text("{not valid json")
    assert run(Args("test-service", dest=str(tmp_path))) == 1


def test_validate_missing_evals_key_fails(tmp_path):
    brain = tmp_path / "test-service-brain"
    _make_valid_brain(brain)
    (brain / "03-evals.json").write_text(json.dumps({"service": "x", "version": "1.0"}))
    assert run(Args("test-service", dest=str(tmp_path))) == 1


def test_validate_evals_not_array_fails(tmp_path):
    brain = tmp_path / "test-service-brain"
    _make_valid_brain(brain)
    (brain / "03-evals.json").write_text(json.dumps({
        "service": "x", "version": "1.0", "evals": "not an array"
    }))
    assert run(Args("test-service", dest=str(tmp_path))) == 1


def test_validate_brain_not_found_fails(tmp_path):
    assert run(Args("nonexistent", dest=str(tmp_path))) == 1


def test_validate_accepts_direct_path(tmp_path):
    brain = tmp_path / "my-brain-brain"
    _make_valid_brain(brain)
    assert run(Args(str(brain))) == 0


def test_validate_accepts_brain_suffix_in_name(tmp_path):
    brain = tmp_path / "my-service-brain"
    _make_valid_brain(brain)
    assert run(Args("my-service-brain", dest=str(tmp_path))) == 0


def test_validate_multiple_placeholders_counted(tmp_path, capsys):
    brain = tmp_path / "test-service-brain"
    _make_valid_brain(brain)
    (brain / "01-service-definition.md").write_text("REPLACE WITH x\nREPLACE WITH y\nREPLACE WITH z")
    run(Args("test-service", dest=str(tmp_path)))
    out = capsys.readouterr().out
    assert "3 occurrence" in out


def test_validate_owomi_brain_passes():
    """Integration test: the Owomi example brain must pass v1 structural validation."""
    repo_root = Path(__file__).parent.parent.parent
    examples = repo_root / "examples"
    result = run(Args("owomi-tx-categorization", dest=str(examples)))
    assert result == 0

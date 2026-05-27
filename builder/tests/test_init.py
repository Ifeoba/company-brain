import pytest
from pathlib import Path
from unittest.mock import patch

from builder.commands.init import run


class Args:
    def __init__(self, slug, dest=None, force=False):
        self.slug = slug
        self.dest = dest
        self.force = force


def _make_templates(tmp_path: Path) -> Path:
    templates = tmp_path / "fake_templates"
    templates.mkdir()
    for name in ["01-service-definition.md", "brain-readme.md", "progress.md"]:
        (templates / name).write_text(f"REPLACE WITH content for {name}")
    return templates


def test_init_creates_brain_folder(tmp_path):
    templates = _make_templates(tmp_path)
    brains = tmp_path / "brains"
    with patch("builder.commands.init.templates_path", return_value=templates):
        result = run(Args("billing-support", dest=str(brains)))
    assert result == 0
    assert (brains / "billing-support-brain").is_dir()


def test_init_copies_all_template_files(tmp_path):
    templates = _make_templates(tmp_path)
    brains = tmp_path / "brains"
    with patch("builder.commands.init.templates_path", return_value=templates):
        run(Args("billing-support", dest=str(brains)))
    dest = brains / "billing-support-brain"
    assert (dest / "01-service-definition.md").exists()
    assert (dest / "brain-readme.md").exists()
    assert (dest / "progress.md").exists()


def test_init_appends_brain_suffix(tmp_path):
    templates = _make_templates(tmp_path)
    brains = tmp_path / "brains"
    with patch("builder.commands.init.templates_path", return_value=templates):
        run(Args("my-service", dest=str(brains)))
    assert (brains / "my-service-brain").is_dir()


def test_init_accepts_slug_already_ending_in_brain(tmp_path):
    templates = _make_templates(tmp_path)
    brains = tmp_path / "brains"
    with patch("builder.commands.init.templates_path", return_value=templates):
        result = run(Args("my-service-brain", dest=str(brains)))
    assert result == 0
    assert (brains / "my-service-brain").is_dir()


def test_init_creates_brains_dir_if_missing(tmp_path):
    templates = _make_templates(tmp_path)
    brains = tmp_path / "new_brains"
    assert not brains.exists()
    with patch("builder.commands.init.templates_path", return_value=templates):
        run(Args("my-service", dest=str(brains)))
    assert brains.is_dir()


def test_init_rejects_uppercase(tmp_path):
    result = run(Args("Billing-Support", dest=str(tmp_path / "brains")))
    assert result == 1


def test_init_rejects_spaces(tmp_path):
    result = run(Args("billing support", dest=str(tmp_path / "brains")))
    assert result == 1


def test_init_rejects_single_word(tmp_path):
    result = run(Args("billing", dest=str(tmp_path / "brains")))
    assert result == 1


def test_init_rejects_five_words(tmp_path):
    result = run(Args("one-two-three-four-five", dest=str(tmp_path / "brains")))
    assert result == 1


def test_init_rejects_existing_without_force(tmp_path):
    templates = _make_templates(tmp_path)
    brains = tmp_path / "brains"
    with patch("builder.commands.init.templates_path", return_value=templates):
        run(Args("my-service", dest=str(brains)))
        result = run(Args("my-service", dest=str(brains)))
    assert result == 1


def test_init_force_overwrites_existing(tmp_path):
    templates = _make_templates(tmp_path)
    brains = tmp_path / "brains"
    dest = brains / "my-service-brain"
    with patch("builder.commands.init.templates_path", return_value=templates):
        run(Args("my-service", dest=str(brains)))
        # Add a file that shouldn't survive the overwrite
        (dest / "stale-file.md").write_text("old content")
        result = run(Args("my-service", dest=str(brains), force=True))
    assert result == 0
    assert not (dest / "stale-file.md").exists()

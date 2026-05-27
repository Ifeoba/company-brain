import json
import re
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

from builder.interview.runner import InterviewRunner
from builder.interview.steps import STEPS
from builder.scaffolder import REQUIRED_FILES, PLACEHOLDER


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_brain(path: Path, filled: bool = False) -> None:
    """Create a brain folder. filled=True means no placeholders (step done)."""
    path.mkdir(parents=True)
    (path / "progress.md").write_text(
        "# Progress\n"
        "- [ ] Step 1: Service Definition (01-service-definition.md)\n"
        "- [ ] Step 2: Knowledge Layer (02-how-work-happens.md, 02-unwritten-rules.md)\n"
        "- [ ] Step 3: Judgment Layer (03-decision-rules.md, 03-evals.json)\n"
        "- [ ] Step 4: Skills (04-skills.md)\n"
        "- [ ] Step 5: Guardrails (05-guardrails.md)\n"
        "- [ ] Step 6: Proof (06-proof-log.md)\n"
        "- [ ] Validate: `companybrain validate <name>`\n"
    )
    for name in REQUIRED_FILES:
        if filled:
            content = f"# Filled content for {name}\nNo placeholders here."
        else:
            content = f"REPLACE WITH content for {name}"
        (path / name).write_text(content)
    # Fix the JSON file
    if filled:
        (path / "03-evals.json").write_text(
            json.dumps({"service": "test", "version": "1.0", "evals": []})
        )
    else:
        (path / "03-evals.json").write_text('{"service": "REPLACE WITH", "version": "1.0", "evals": []}')


def _make_runner(brain_dir: Path, inputs: list[str], client=None) -> tuple[InterviewRunner, list[str]]:
    """Create an InterviewRunner with mocked input/output and client."""
    input_iter = iter(inputs)
    output: list[str] = []

    def fake_input(prompt: str) -> str:
        return next(input_iter, "")

    def fake_print(*args, **kwargs):
        output.append(" ".join(str(a) for a in args))

    if client is None:
        client = MagicMock()
        client.messages.create.return_value = MagicMock(
            content=[MagicMock(text="# Generated content\nNo REPLACE WITH markers.")]
        )

    runner = InterviewRunner(
        brain_dir=brain_dir,
        client=client,
        model="test-model",
        input_fn=fake_input,
        print_fn=fake_print,
    )
    return runner, output


# ---------------------------------------------------------------------------
# Step definitions
# ---------------------------------------------------------------------------

def test_six_steps_defined():
    assert len(STEPS) == 6


def test_steps_numbered_1_to_6():
    assert [s.number for s in STEPS] == [1, 2, 3, 4, 5, 6]


def test_every_step_has_questions():
    for step in STEPS:
        assert len(step.questions) >= 3, f"Step {step.number} has too few questions"


def test_every_step_has_files():
    for step in STEPS:
        assert step.files or step.json_files, f"Step {step.number} has no files"


def test_step3_has_json_file():
    step3 = next(s for s in STEPS if s.number == 3)
    assert "03-evals.json" in step3.json_files


# ---------------------------------------------------------------------------
# _is_done
# ---------------------------------------------------------------------------

def test_is_done_false_when_placeholders_remain(tmp_path):
    brain = tmp_path / "test-brain"
    _make_brain(brain, filled=False)
    runner, _ = _make_runner(brain, inputs=[])
    step1 = STEPS[0]
    assert not runner._is_done(step1)


def test_is_done_true_when_no_placeholders(tmp_path):
    brain = tmp_path / "test-brain"
    _make_brain(brain, filled=True)
    runner, _ = _make_runner(brain, inputs=[])
    step1 = STEPS[0]
    assert runner._is_done(step1)


def test_is_done_false_when_file_missing(tmp_path):
    brain = tmp_path / "test-brain"
    _make_brain(brain, filled=True)
    (brain / "01-service-definition.md").unlink()
    runner, _ = _make_runner(brain, inputs=[])
    step1 = STEPS[0]
    assert not runner._is_done(step1)


# ---------------------------------------------------------------------------
# _mark_progress
# ---------------------------------------------------------------------------

def test_mark_progress_checks_off_step(tmp_path):
    brain = tmp_path / "test-brain"
    _make_brain(brain, filled=False)
    runner, _ = _make_runner(brain, inputs=[])
    runner._mark_progress(1)
    progress = (brain / "progress.md").read_text()
    assert "- [x] Step 1:" in progress
    assert "- [ ] Step 2:" in progress


def test_mark_progress_only_checks_target_step(tmp_path):
    brain = tmp_path / "test-brain"
    _make_brain(brain, filled=False)
    runner, _ = _make_runner(brain, inputs=[])
    runner._mark_progress(3)
    progress = (brain / "progress.md").read_text()
    assert "- [ ] Step 1:" in progress
    assert "- [x] Step 3:" in progress


def test_mark_progress_noop_when_no_progress_file(tmp_path):
    brain = tmp_path / "test-brain"
    brain.mkdir()
    runner, _ = _make_runner(brain, inputs=[])
    runner._mark_progress(1)  # should not raise


# ---------------------------------------------------------------------------
# _generate_and_confirm
# ---------------------------------------------------------------------------

def test_file_written_on_yes(tmp_path):
    brain = tmp_path / "test-brain"
    _make_brain(brain, filled=False)

    client = MagicMock()
    client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="# Service Definition\n\nReal content here.")]
    )

    # _generate_and_confirm only calls input once (the confirm prompt)
    inputs = ["y"]
    runner, _ = _make_runner(brain, inputs=inputs, client=client)

    with patch("builder.interview.runner.templates_path") as mock_tp:
        fake_templates = tmp_path / "templates"
        fake_templates.mkdir()
        (fake_templates / "01-service-definition.md").write_text("REPLACE WITH something")
        mock_tp.return_value = fake_templates
        runner._generate_and_confirm("01-service-definition.md", {"key": "val"}, json_mode=False)

    content = (brain / "01-service-definition.md").read_text()
    assert "Real content here" in content


def test_file_not_written_on_no(tmp_path):
    brain = tmp_path / "test-brain"
    _make_brain(brain, filled=False)
    original = (brain / "01-service-definition.md").read_text()

    client = MagicMock()
    client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="# New content")]
    )

    runner, _ = _make_runner(brain, inputs=["n"], client=client)

    with patch("builder.interview.runner.templates_path") as mock_tp:
        fake_templates = tmp_path / "templates"
        fake_templates.mkdir()
        (fake_templates / "01-service-definition.md").write_text("REPLACE WITH something")
        mock_tp.return_value = fake_templates
        wrote = runner._generate_and_confirm("01-service-definition.md", {"key": "val"}, json_mode=False)

    assert not wrote
    assert (brain / "01-service-definition.md").read_text() == original


def test_file_written_on_edit(tmp_path):
    brain = tmp_path / "test-brain"
    _make_brain(brain, filled=False)

    client = MagicMock()
    client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="# Editable content")]
    )

    runner, _ = _make_runner(brain, inputs=["edit"], client=client)

    with patch("builder.interview.runner.templates_path") as mock_tp:
        fake_templates = tmp_path / "templates"
        fake_templates.mkdir()
        (fake_templates / "01-service-definition.md").write_text("REPLACE WITH something")
        mock_tp.return_value = fake_templates
        wrote = runner._generate_and_confirm("01-service-definition.md", {"key": "val"}, json_mode=False)

    assert wrote


# ---------------------------------------------------------------------------
# Full run
# ---------------------------------------------------------------------------

def test_completed_step_is_skipped(tmp_path):
    brain = tmp_path / "test-brain"
    _make_brain(brain, filled=True)
    runner, output = _make_runner(brain, inputs=[])
    runner.run()
    skipped = [l for l in output if "already complete" in l]
    assert len(skipped) == 6


def test_run_calls_claude_for_unfilled_step(tmp_path):
    brain = tmp_path / "test-brain"
    _make_brain(brain, filled=False)

    client = MagicMock()
    client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="# Content\nFilled in.")]
    )

    # Enough inputs: answers for all questions across all steps + "n" to skip writes
    inputs = ["answer"] * 50 + ["n"] * 20
    runner, _ = _make_runner(brain, inputs=inputs, client=client)

    with patch("builder.interview.runner.templates_path") as mock_tp:
        fake_templates = tmp_path / "templates"
        fake_templates.mkdir()
        for name in REQUIRED_FILES:
            (fake_templates / name).write_text("REPLACE WITH template content")
        mock_tp.return_value = fake_templates
        runner.run()

    assert client.messages.create.called

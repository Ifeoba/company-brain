import re
import sys
from pathlib import Path
from typing import Callable

from builder.scaffolder import PLACEHOLDER, templates_path
from builder.interview.steps import STEPS, Step

_SYSTEM_PROMPT = """\
You are filling in a company brain template file for a specific service.
The user has answered interview questions about their service. Your job is to produce
a complete, specific, filled-in version of the template based on their answers.

Rules:
- Replace every "REPLACE WITH" marker with real, specific content drawn from the user's answers
- Remove all HTML comment blocks (<!-- ... -->) entirely
- Keep all section headers, table structures, and formatting
- Write in plain, direct language — no padding, no hedging
- If the user's answers do not cover a section, write [TO BE FILLED IN] for that section
- Output only the file content — no preamble, no explanation, nothing before or after\
"""

_SYSTEM_PROMPT_JSON = """\
You are filling in a company brain JSON file for a specific service.
The user has answered interview questions. Produce a complete, filled-in version
of the JSON template based on their answers.

Rules:
- Replace every "REPLACE WITH" marker inside string values with real content from the answers
- Output valid JSON only — no markdown code fences, no explanation, nothing else
- Keep all required keys (id, description, difficulty, source, input, expected_output)
- Include at least the eval cases the user described; add structure for any gaps
- difficulty must be one of: "routine", "edge", "hard"\
"""


class InterviewRunner:
    def __init__(
        self,
        brain_dir: Path,
        client,
        model: str,
        input_fn: Callable[[str], str] = None,
        print_fn: Callable = None,
    ):
        self.brain_dir = brain_dir
        self.client = client
        self.model = model
        self._input = input_fn or self._default_input
        self._print = print_fn or print
        self._company_name = ""
        self._service_description = ""

    @staticmethod
    def _default_input(prompt: str) -> str:
        print(prompt, end="", flush=True)
        return sys.stdin.readline().rstrip("\n")

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def run(self, start_step: int = 1) -> None:
        brain_name = self.brain_dir.name[:-6] if self.brain_dir.name.endswith("-brain") else self.brain_dir.name
        self._print(f"\nCompany Brain Builder — Interview Mode")
        self._print(f"Brain: {self.brain_dir}/\n")

        self._collect_context()

        completed = 0
        for step in STEPS:
            if step.number < start_step:
                continue
            if self._is_done(step):
                self._print(f"  ✓ Step {step.number} ({step.name}) — already complete, skipping")
                self._preview_step(step)
                completed += 1
                continue
            wrote = self._run_step(step)
            if wrote:
                self._mark_progress(step.number)
                completed += 1

        self._print(f"\n{'─' * 50}")
        self._print(f"  Done. {completed}/6 steps complete.")
        self._print(f"  Run: companybrain validate {brain_name}")
        self._print(f"  Then load the company-brain-validator skill in Claude for a full content review.")

    # ------------------------------------------------------------------
    # Context collection
    # ------------------------------------------------------------------

    def _collect_context(self) -> None:
        self._print("Before we start, two quick questions to give Claude context.\n")

        self._print("Q: What is the name of your company?\n")
        self._company_name = self._input("> ").strip()
        self._print("")

        self._print(
            "Q: What does this agent do? Be specific: what triggers it, what does it\n"
            "   read or check, what decision does it make, and what does it output or act on?\n"
            "   e.g. \"When a transaction has null confidence, the agent checks user rules,\n"
            "   applies decision logic, and either auto-assigns a category or queues it for review.\"\n"
        )
        self._service_description = self._input("> ").strip()
        self._print("")

    def _preview_step(self, step: Step) -> None:
        """Print the first two meaningful content lines from the step's primary file."""
        primary = (step.files + step.json_files)[0]
        path = self.brain_dir / primary
        if not path.exists():
            return
        lines = []
        in_html_comment = False
        for raw in path.read_text(encoding="utf-8").splitlines():
            stripped = raw.strip()
            if "<!--" in stripped:
                in_html_comment = True
            if in_html_comment:
                if "-->" in stripped:
                    in_html_comment = False
                continue
            if not stripped or stripped.startswith("#"):
                continue
            lines.append(stripped[:80] + ("…" if len(stripped) > 80 else ""))
            if len(lines) == 2:
                break
        for line in lines:
            self._print(f"      {line}")

    # ------------------------------------------------------------------
    # Step execution
    # ------------------------------------------------------------------

    def _run_step(self, step: Step) -> bool:
        """Run one step. Returns True if files were written."""
        self._print(f"\n{'━' * 50}")
        self._print(f"  Step {step.number} of 6: {step.name}")
        files_display = ", ".join(step.files + step.json_files)
        self._print(f"  Files: {files_display}")
        self._print(f"{'━' * 50}\n")
        self._print("Answer the questions below. Your answers don't need to be polished —")
        self._print("I'll turn them into the formatted file.\n")

        answers = self._collect_answers(step)

        wrote_any = False
        for filename in step.files:
            wrote = self._generate_and_confirm(filename, answers, json_mode=False, step_number=step.number)
            wrote_any = wrote_any or wrote

        for filename in step.json_files:
            wrote = self._generate_and_confirm(filename, answers, json_mode=True, step_number=step.number)
            wrote_any = wrote_any or wrote

        return wrote_any

    def _collect_answers(self, step: Step) -> dict[str, str]:
        answers: dict[str, str] = {}
        for q in step.questions:
            self._print(f"Q: {q.text}\n")
            answer = self._input("> ").strip()
            answers[q.key] = answer
            self._print("")
        return answers

    def _generate_and_confirm(self, filename: str, answers: dict[str, str], json_mode: bool, step_number: int = 1) -> bool:
        """Generate content, show it, ask for confirmation. Returns True if written."""
        self._print(f"Generating {filename}...")
        try:
            content = self._call_claude(filename, answers, json_mode)
        except Exception as e:
            self._print(f"✗ Claude API error: {e}")
            return False

        self._print(f"\n{'─' * 50}")
        self._print(content)
        self._print(f"{'─' * 50}\n")

        response = self._input("Write this to file? [Y/n/edit] ").strip().lower()
        if response in ("", "y", "yes"):
            self._write_file(filename, content)
            self._print(f"✓ Written to {self.brain_dir / filename}")
            return True
        elif response in ("edit",):
            self._write_file(filename, content)
            self._print(f"✓ Written to {self.brain_dir / filename}")
            self._print(f"  Open that file to make edits before continuing.")
            return True
        else:
            brain_name = self.brain_dir.name[:-6] if self.brain_dir.name.endswith("-brain") else self.brain_dir.name
            self._print(f"  Skipped. To retry: companybrain interview {brain_name} --step {step_number}")
            return False

    # ------------------------------------------------------------------
    # Claude API
    # ------------------------------------------------------------------

    def _call_claude(self, filename: str, answers: dict[str, str], json_mode: bool) -> str:
        template_file = templates_path() / filename
        if not template_file.exists():
            raise FileNotFoundError(f"Template not found: {template_file}")
        template = template_file.read_text(encoding="utf-8")

        answers_text = "\n\n".join(
            f"**{key.replace('_', ' ').title()}**\n{answer}"
            for key, answer in answers.items()
            if answer
        )

        context_lines = ""
        if self._company_name or self._service_description:
            context_lines = (
                f"Company: {self._company_name}\n"
                f"Service: {self._service_description}\n\n"
            )

        system = _SYSTEM_PROMPT_JSON if json_mode else _SYSTEM_PROMPT
        user = (
            f"{context_lines}"
            f"Template for {filename}:\n\n{template}\n\n"
            f"---\nUser's answers:\n\n{answers_text}"
        )

        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return response.content[0].text

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _is_done(self, step: Step) -> bool:
        for filename in step.files + step.json_files:
            f = self.brain_dir / filename
            if not f.exists() or PLACEHOLDER in f.read_text(encoding="utf-8"):
                return False
        return True

    def _write_file(self, filename: str, content: str) -> None:
        (self.brain_dir / filename).write_text(content, encoding="utf-8")

    def _mark_progress(self, step_number: int) -> None:
        progress_file = self.brain_dir / "progress.md"
        if not progress_file.exists():
            return
        text = progress_file.read_text(encoding="utf-8")
        updated = re.sub(
            rf"- \[ \] (Step {step_number}:)",
            r"- [x] \1",
            text,
        )
        progress_file.write_text(updated, encoding="utf-8")

from company_brain.runtime.runner import RuntimeRunner


def test_runtime_exists():
    runner = RuntimeRunner()
    assert runner is not None

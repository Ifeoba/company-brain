from company_brain.runtime.executor import Executor


def test_executor_exists():
    executor = Executor()
    assert executor is not None

def test_executor_run():
    executor = Executor()
    result = executor.execute("test-task")
    assert result["status"] == "success"

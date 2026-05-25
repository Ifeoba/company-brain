from company_brain.runtime.engine import RuntimeEngine


def test_engine_exists():
    engine = RuntimeEngine()
    assert engine is not None

def test_engine_register():
    engine = RuntimeEngine()
    engine.register(lambda: None)
    assert len(engine.workflows) == 1

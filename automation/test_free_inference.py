"""Offline unit tests: no API keys or external network calls needed."""
import importlib.util
import pathlib
import unittest

SCRIPT = pathlib.Path(__file__).with_name("free_inference.py")
spec = importlib.util.spec_from_file_location("free_inference", SCRIPT)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class TestFreeInference(unittest.TestCase):
    def test_missing_credentials(self):
        self.assertEqual(worker.configured_providers({}), [])

    def test_groq_only(self):
        providers = worker.configured_providers({"GROQ_API_KEY": "dummy"})
        self.assertEqual(len(providers), 1)
        self.assertEqual(providers[0]["model"], "openai/gpt-oss-120b")

    def test_openrouter_must_be_free(self):
        with self.assertRaises(ValueError):
            worker.configured_providers({
                "OPENROUTER_API_KEY": "dummy",
                "OPENROUTER_FREE_MODEL": "anthropic/claude",
            })

    def test_success_without_real_network(self):
        calls = []
        def fake(url, headers, data):
            calls.append((url, data["model"]))
            return {"choices": [{"message": {"content": "Готово, черновик."}}]}
        result = worker.generate("Напиши черновик", [
            {"name": "groq", "url": "https://fake.invalid",
             "key": "fake", "model": "openai/gpt-oss-120b"}], fake)
        self.assertEqual(result["status"], "DRAFT_ONLY")
        self.assertIn("черновик", result["result"])
        self.assertEqual(len(calls), 1)

    def test_failover_on_rate_limit(self):
        attempts = []
        def fake(url, headers, data):
            attempts.append(url)
            if len(attempts) == 1:
                raise worker.ProviderFailure("http", 429, "rate limit")
            return {"choices": [{"message": {"content": "Fallback works"}}]}
        providers = [
            {"name": "groq", "url": "https://first.invalid",
             "key": "a", "model": "openai/gpt-oss-120b"},
            {"name": "openrouter", "url": "https://second.invalid",
             "key": "b", "model": "free/model:free"},
        ]
        result = worker.generate("test", providers, fake)
        self.assertEqual(result["provider"], "openrouter")
        self.assertEqual(len(attempts), 2)

    def test_no_failover_for_bad_credentials(self):
        attempts = []
        def fake(url, headers, data):
            attempts.append(url)
            raise worker.ProviderFailure("http", 401, "bad key")
        provider = {"name": "groq", "url": "https://first.invalid",
                    "key": "a", "model": "openai/gpt-oss-120b"}
        result = worker.generate("test", [provider, provider], fake)
        self.assertEqual(result["status"], "FAILED")
        self.assertEqual(len(attempts), 1)

    def test_prompt_limit(self):
        with self.assertRaises(ValueError):
            worker.generate("x" * 12001, [])


if __name__ == "__main__":
    unittest.main()

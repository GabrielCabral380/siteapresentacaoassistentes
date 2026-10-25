import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

from openclaw_integracao import openclaw_local as oc


class TestOpenClaw(unittest.TestCase):
    def execute(self, code, stdout):
        result = subprocess.CompletedProcess([], code, stdout, 'diagnostico')
        with patch.object(oc, 'preparar', return_value=(['node', 'openclaw.mjs'], {})), \
             patch.object(oc, 'verificar_ollama'), \
             patch.object(subprocess, 'run', return_value=result) as run, \
             patch.object(Path, 'write_text'):
            data = oc.openclaw_executar('Mensagem com "aspas" e & caracteres', oc.BASE)
            command = run.call_args.args[0]
            self.assertIn('--message-file', command)
            self.assertEqual(run.call_args.kwargs['input'], 'Mensagem com "aspas" e & caracteres')
            self.assertFalse(run.call_args.kwargs.get('shell', False))
            return data

    def test_success(self):
        self.assertTrue(self.execute(0, json.dumps({'ok': True, 'final': 'feito'}))['ok'])

    def test_failure_exit_not_hidden(self):
        self.assertFalse(self.execute(1, json.dumps({'ok': True, 'final': 'feito'}))['ok'])

    def test_invalid_output_not_success(self):
        self.assertFalse(self.execute(0, 'texto nao estruturado')['ok'])

    def test_non_object_json_is_failure(self):
        self.assertFalse(self.execute(0, '[]')['ok'])

    def test_warning_before_json(self):
        self.assertTrue(self.execute(0, 'aviso\n{"ok": true, "final": "feito"}')['ok'])

    def test_outside_workspace_refused(self):
        with patch.object(oc, 'preparar', return_value=([], {})), \
             patch.object(oc, 'verificar_ollama'), patch.object(subprocess, 'run') as run:
            self.assertFalse(oc.openclaw_executar('teste', oc.ROOT.parent)['ok'])
            run.assert_not_called()

    def test_timeout_is_failure(self):
        with patch.object(oc, 'preparar', return_value=([], {})), \
             patch.object(oc, 'verificar_ollama'), \
             patch.object(subprocess, 'run', side_effect=subprocess.TimeoutExpired('node', 1)):
            self.assertFalse(oc.openclaw_executar('teste', oc.BASE)['ok'])


if __name__ == '__main__':
    unittest.main()

import sys
import runpy
import unittest
from unittest.mock import Mock, patch

import run


class RunScriptTests(unittest.TestCase):
    def test_port_probe_reports_open_and_closed(self):
        for status, expected in [(0, True), (1, False)]:
            connection = Mock()
            connection.__enter__ = Mock(return_value=connection)
            connection.__exit__ = Mock(return_value=False)
            connection.connect_ex.return_value = status
            with patch("run.socket.socket", return_value=connection):
                self.assertEqual(run.is_port_in_use(), expected)
            connection.settimeout.assert_called_once_with(0.5)
            connection.connect_ex.assert_called_once_with((run.HOST, run.PORT))

    def test_open_browser_waits_for_server_delay(self):
        with patch("run.time.sleep") as sleep, patch("run.webbrowser.open") as open_browser:
            run.open_browser_when_ready()
        sleep.assert_called_once_with(run.BROWSER_DELAY_SECONDS)
        open_browser.assert_called_once_with(run.URL)

    def test_main_reuses_existing_port(self):
        with patch("run.os.chdir"), patch("run.is_port_in_use", return_value=True), patch("run.webbrowser.open") as open_browser, patch("run.uvicorn.run") as server:
            self.assertEqual(run.main(), 0)
        open_browser.assert_called_once_with(run.URL)
        server.assert_not_called()

    def test_main_starts_server_and_honors_reload_flag(self):
        thread = Mock()
        with patch("run.os.chdir"), patch("run.is_port_in_use", return_value=False), patch("run.threading.Thread", return_value=thread) as create_thread, patch("run.uvicorn.run") as server, patch.object(sys, "argv", ["run.py", "--reload"]):
            self.assertEqual(run.main(), 0)
        create_thread.assert_called_once()
        thread.start.assert_called_once()
        server.assert_called_once_with("backend.main:app", host=run.HOST, port=run.PORT, reload=True)

    def test_module_entrypoint_exits_with_main_result(self):
        connection = Mock()
        connection.__enter__ = Mock(return_value=connection)
        connection.__exit__ = Mock(return_value=False)
        connection.connect_ex.return_value = 0
        with patch("run.socket.socket", return_value=connection), patch("run.webbrowser.open"), self.assertRaises(SystemExit) as error:
            runpy.run_path(run.__file__, run_name="__main__")
        self.assertEqual(error.exception.code, 0)


if __name__ == "__main__":
    unittest.main()

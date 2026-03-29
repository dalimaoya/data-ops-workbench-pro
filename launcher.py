#!/usr/bin/env python3
"""
数据运维工作台 - Windows 桌面启动器
pywebview 主窗口 + tkinter 控制面板 + pystray 系统托盘

v5.0: 集成 pywebview（WebView2）作为主窗口
  - 启动后台 dataops-server，等待端口就绪
  - pywebview 窗口加载 http://localhost:9590
  - pywebview 不可用时自动降级到系统浏览器
  - 关闭窗口最小化到系统托盘
  - tkinter 控制面板：运行状态/端口/版本/打开浏览器/检查更新/重启/退出
  - 托盘右键菜单：打开窗口/在浏览器中打开/控制面板/退出
"""

import os
import sys
import subprocess
import threading
import webbrowser
import time
import json
import tkinter as tk
from tkinter import ttk, messagebox
from urllib.request import urlopen, Request
from urllib.error import URLError
from datetime import datetime

# ── 版本号读取 ──────────────────────────────────────────────────
def _read_version():
    _fallback = "5.0.0"
    base = os.path.dirname(os.path.abspath(__file__))
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    for name in ("version.txt",):
        p = os.path.join(base, name)
        if os.path.isfile(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    v = f.read().strip().lstrip("vV")
                    if v:
                        return v
            except Exception:
                pass
    pkg = os.path.join(base, "package.json")
    if os.path.isfile(pkg):
        try:
            with open(pkg, "r", encoding="utf-8") as f:
                return json.load(f).get("version", _fallback)
        except Exception:
            pass
    return _fallback

CURRENT_VERSION = _read_version()
PORT = 9590
URL = f"http://localhost:{PORT}"

# ── psutil 可选 ─────────────────────────────────────────────────
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

# ── pystray 可选 ────────────────────────────────────────────────
try:
    import pystray
    from PIL import Image, ImageDraw, ImageFont
    HAS_TRAY = True
except ImportError:
    HAS_TRAY = False

# ── pywebview 可选 ──────────────────────────────────────────────
try:
    import webview
    HAS_WEBVIEW = True
except ImportError:
    HAS_WEBVIEW = False


# ── 定位可执行文件 ──────────────────────────────────────────────
def _find_server_bin():
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(base, "server", "app.exe"),
        os.path.join(base, "server", "app"),
        os.path.join(base, "server", "dataops-server.exe"),
        os.path.join(base, "server", "dataops-server"),
        os.path.join(base, "server", "app", "dataops-server.exe"),
        os.path.join(base, "server", "app", "dataops-server"),
        os.path.join(base, "server", "app", "app.exe"),
        os.path.join(base, "dataops-server.exe"),
        os.path.join(base, "dataops-server"),
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    return None


# ── 定位图标文件 ────────────────────────────────────────────────
def _find_icon():
    base = os.path.dirname(os.path.abspath(__file__))
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    ico = os.path.join(base, "icon.ico")
    return ico if os.path.isfile(ico) else None


# ── 托盘图标生成 ────────────────────────────────────────────────
def _create_icon_image(size=64, color=(52, 120, 246)):
    if not HAS_TRAY:
        return None
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([2, 2, size - 2, size - 2], fill=color, outline=tuple(max(0, c - 30) for c in color), width=2)
    try:
        font = ImageFont.truetype("arial.ttf", size // 2)
    except Exception:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), "D", font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1]), "D", fill="white", font=font)
    return img


# ── 版本在线检测 ────────────────────────────────────────────────
GITHUB_RELEASES_API = "https://api.github.com/repos/dalimaoya/data-ops-workbench-pro/releases/latest"
GITHUB_RELEASES_PAGE = "https://github.com/dalimaoya/data-ops-workbench-pro/releases/latest"


def _parse_version(v: str):
    parts = []
    for p in v.split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(0)
    return tuple(parts)


def _check_update(current_version, callback):
    def _worker():
        try:
            req = Request(GITHUB_RELEASES_API,
                          headers={"Accept": "application/vnd.github.v3+json",
                                   "User-Agent": "DataOpsWorkbench"})
            with urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            tag = data.get("tag_name", "")
            latest = tag.lstrip("vV")
            if latest and _parse_version(latest) > _parse_version(current_version):
                callback(latest)
        except Exception:
            pass
    threading.Thread(target=_worker, daemon=True).start()


# ══════════════════════════════════════════════════════════════════
class LauncherApp:
    """主启动器：pywebview 窗口 + tkinter 控制面板 + 系统托盘"""

    # 颜色常量
    BG = "#f5f7fa"
    HEADER_BG = "#3478f6"
    GREEN = "#27ae60"
    RED = "#e74c3c"
    ORANGE = "#e67e22"
    GRAY = "#888"

    def __init__(self):
        self.process = None
        self.tray_icon = None
        self.webview_window = None
        self.server_state = "stopped"  # stopped / starting / running
        self.server_bin = _find_server_bin()
        self.start_time = None
        self._health_thread = None
        self._monitor_running = True
        self._webview_failed = False
        self._quitting = False

        # ── tkinter 控制面板（后台创建，按需显示）──
        self.root = tk.Tk()
        self.root.title(f"数据运维工作台 控制面板  v{CURRENT_VERSION}")
        self.root.geometry("440x360")
        self.root.resizable(False, False)
        self.root.configure(bg=self.BG)
        self.root.protocol("WM_DELETE_WINDOW", self._hide_panel)

        self._set_window_icon()
        self._build_panel_ui()

        # 控制面板默认隐藏（pywebview 可用时）
        if HAS_WEBVIEW:
            self.root.withdraw()

        self._start_tray()

        # 启动时自动启动后端服务
        self.root.after(300, self._start_service)

        # 启动资源监控
        self._schedule_monitor()

        # 检查更新
        self._check_for_update()

    # ── 窗口图标 ────────────────────────────────────────────────
    def _set_window_icon(self):
        ico = _find_icon()
        if ico:
            try:
                self.root.iconbitmap(ico)
            except Exception:
                pass

    # ── 控制面板 UI 布局 ─────────────────────────────────────────
    def _build_panel_ui(self):
        root = self.root

        # ── 顶部标题栏 ──
        header = tk.Frame(root, bg=self.HEADER_BG, height=56)
        header.pack(fill=tk.X)
        header.pack_propagate(False)
        tk.Label(header,
                 text=f"数据运维工作台  v{CURRENT_VERSION}",
                 font=("Microsoft YaHei", 15, "bold"),
                 fg="white", bg=self.HEADER_BG).pack(pady=13)

        # ── 信息区域 ──
        info = tk.Frame(root, bg=self.BG, padx=28, pady=18)
        info.pack(fill=tk.X)

        row = 0

        # 运行状态
        tk.Label(info, text="运行状态：", font=("Microsoft YaHei", 11),
                 bg=self.BG, fg="#333").grid(row=row, column=0, sticky="w", pady=4)
        self.status_dot = tk.Label(info, text="●", font=("Microsoft YaHei", 12),
                                   bg=self.BG, fg=self.GRAY)
        self.status_dot.grid(row=row, column=1, sticky="w", pady=4)
        self.status_text = tk.Label(info, text="准备启动", font=("Microsoft YaHei", 11, "bold"),
                                    bg=self.BG, fg=self.GRAY)
        self.status_text.grid(row=row, column=2, sticky="w", pady=4)
        row += 1

        # 服务端口
        tk.Label(info, text="服务端口：", font=("Microsoft YaHei", 11),
                 bg=self.BG, fg="#333").grid(row=row, column=0, sticky="w", pady=4)
        tk.Label(info, text=str(PORT), font=("Microsoft YaHei", 11),
                 bg=self.BG, fg="#555").grid(row=row, column=1, columnspan=2, sticky="w", pady=4)
        row += 1

        # 服务地址
        tk.Label(info, text="服务地址：", font=("Microsoft YaHei", 11),
                 bg=self.BG, fg="#333").grid(row=row, column=0, sticky="w", pady=4)
        addr_label = tk.Label(info, text=URL, font=("Microsoft YaHei", 11),
                              bg=self.BG, fg="#3478f6", cursor="hand2")
        addr_label.grid(row=row, column=1, columnspan=2, sticky="w", pady=4)
        addr_label.bind("<Button-1>", lambda e: webbrowser.open(URL))
        row += 1

        # 启动时间
        tk.Label(info, text="启动时间：", font=("Microsoft YaHei", 11),
                 bg=self.BG, fg="#333").grid(row=row, column=0, sticky="w", pady=4)
        self.time_label = tk.Label(info, text="—", font=("Microsoft YaHei", 11),
                                   bg=self.BG, fg="#555")
        self.time_label.grid(row=row, column=1, columnspan=2, sticky="w", pady=4)
        row += 1

        # 当前版本
        tk.Label(info, text="当前版本：", font=("Microsoft YaHei", 11),
                 bg=self.BG, fg="#333").grid(row=row, column=0, sticky="w", pady=4)
        tk.Label(info, text=f"v{CURRENT_VERSION}", font=("Microsoft YaHei", 11),
                 bg=self.BG, fg="#555").grid(row=row, column=1, columnspan=2, sticky="w", pady=4)
        row += 1

        # CPU / 内存（仅 psutil 可用时显示）
        if HAS_PSUTIL:
            tk.Label(info, text="CPU / 内存：", font=("Microsoft YaHei", 11),
                     bg=self.BG, fg="#333").grid(row=row, column=0, sticky="w", pady=4)
            self.res_label = tk.Label(info, text="— / —", font=("Microsoft YaHei", 11),
                                      bg=self.BG, fg="#555")
            self.res_label.grid(row=row, column=1, columnspan=2, sticky="w", pady=4)
            row += 1
        else:
            self.res_label = None

        # 未找到服务器的警告
        if not self.server_bin:
            tk.Label(info, text="⚠ 未找到 dataops-server，请检查安装目录",
                     font=("Microsoft YaHei", 9), bg=self.BG, fg=self.ORANGE).grid(
                row=row, column=0, columnspan=3, sticky="w", pady=6)
            row += 1

        # ── 按钮区域 ──
        btn_frame = tk.Frame(root, bg=self.BG, padx=28, pady=10)
        btn_frame.pack(fill=tk.X)

        style = ttk.Style()
        style.configure("Action.TButton", font=("Microsoft YaHei", 10), padding=6)

        self.btn_browser = ttk.Button(btn_frame, text="在浏览器中打开", style="Action.TButton",
                                      command=lambda: webbrowser.open(URL))
        self.btn_browser.grid(row=0, column=0, padx=4, sticky="ew")

        self.btn_update = ttk.Button(btn_frame, text="检查更新", style="Action.TButton",
                                     command=self._check_for_update)
        self.btn_update.grid(row=0, column=1, padx=4, sticky="ew")

        self.btn_restart = ttk.Button(btn_frame, text="重启服务", style="Action.TButton",
                                      command=self._restart_service)
        self.btn_restart.grid(row=1, column=0, padx=4, pady=(6, 0), sticky="ew")

        self.btn_quit = ttk.Button(btn_frame, text="退出程序", style="Action.TButton",
                                   command=self._quit_app)
        self.btn_quit.grid(row=1, column=1, padx=4, pady=(6, 0), sticky="ew")

        btn_frame.columnconfigure(0, weight=1)
        btn_frame.columnconfigure(1, weight=1)

        # ── 底部提示 ──
        footer = tk.Frame(root, bg="#eee", height=26)
        footer.pack(fill=tk.X, side=tk.BOTTOM)
        footer.pack_propagate(False)
        tk.Label(footer, text="关闭窗口 → 隐藏面板  |  托盘右键 → 更多操作",
                 font=("Microsoft YaHei", 8), bg="#eee", fg="#999").pack(pady=3)

    # ── 状态更新 ─────────────────────────────────────────────────
    def _set_state(self, state: str):
        self.server_state = state
        colors = {"stopped": self.RED, "starting": self.ORANGE, "running": self.GREEN}
        labels = {"stopped": "已停止", "starting": "启动中…", "running": "运行中"}
        c = colors.get(state, self.GRAY)
        t = labels.get(state, state)
        try:
            self.status_dot.config(fg=c)
            self.status_text.config(text=t, fg=c)
        except Exception:
            pass
        # 更新托盘图标颜色
        self._update_tray_icon_color(state)

    def _update_tray_icon_color(self, state: str):
        if not self.tray_icon or not HAS_TRAY:
            return
        color_map = {
            "running": (39, 174, 96),    # green
            "starting": (230, 126, 34),  # orange
            "stopped": (231, 76, 60),    # red
        }
        color = color_map.get(state, (136, 136, 136))
        try:
            self.tray_icon.icon = _create_icon_image(color=color)
        except Exception:
            pass

    # ── 资源监控定时器 ───────────────────────────────────────────
    def _schedule_monitor(self):
        if not self._monitor_running:
            return
        self._update_resources()
        self.root.after(3000, self._schedule_monitor)

    def _update_resources(self):
        if not HAS_PSUTIL or not self.res_label or not self.process:
            return
        try:
            proc = psutil.Process(self.process.pid)
            cpu = proc.cpu_percent(interval=0)
            mem = proc.memory_info().rss / (1024 * 1024)
            self.res_label.config(text=f"{cpu:.1f}% / {mem:.0f}MB")
        except Exception:
            if self.res_label:
                self.res_label.config(text="— / —")

    # ── 端口占用检测 ─────────────────────────────────────────────
    def _kill_port_occupier(self):
        if sys.platform != "win32":
            return
        try:
            result = subprocess.run(
                ["netstat", "-aon"],
                capture_output=True, text=True, timeout=5
            )
            for line in result.stdout.splitlines():
                if f":{PORT} " in line and "LISTENING" in line:
                    parts = line.strip().split()
                    pid = parts[-1]
                    if pid.isdigit() and int(pid) > 0:
                        try:
                            subprocess.run(["taskkill", "/F", "/PID", pid],
                                           capture_output=True, timeout=5)
                        except Exception:
                            pass
        except Exception:
            pass

    # ── 服务启动 ─────────────────────────────────────────────────
    def _start_service(self):
        if not self.server_bin:
            self._set_state("stopped")
            return
        if self.server_state == "running":
            return

        self._set_state("starting")

        base_dir = os.path.dirname(self.server_bin)
        release_root = os.path.abspath(os.path.join(base_dir, "..", ".."))
        env = os.environ.copy()
        env["DATA_OPS_BASE_DIR"] = release_root
        env["DATA_OPS_DATA_DIR"] = os.path.join(release_root, "data")

        for d in ("data", "backups", "logs"):
            os.makedirs(os.path.join(release_root, d), exist_ok=True)

        creation_flags = 0
        if sys.platform == "win32":
            creation_flags = subprocess.CREATE_NO_WINDOW

        self._kill_port_occupier()

        try:
            self.process = subprocess.Popen(
                [self.server_bin, "--port", str(PORT)],
                env=env,
                creationflags=creation_flags,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            self.start_time = datetime.now()
            self.time_label.config(text=self.start_time.strftime("%Y-%m-%d %H:%M:%S"))

            # 后台健康检查
            self._health_thread = threading.Thread(target=self._wait_for_ready, daemon=True)
            self._health_thread.start()
        except Exception as e:
            self._set_state("stopped")
            messagebox.showerror("启动失败", str(e))

    def _wait_for_ready(self):
        """轮询 /api/health，通过后打开 pywebview 窗口或降级到浏览器"""
        max_wait = 60
        waited = 0
        while waited < max_wait and self.server_state == "starting":
            if self.process and self.process.poll() is not None:
                self.root.after(0, lambda: self._set_state("stopped"))
                return
            try:
                req = Request(f"{URL}/api/health",
                              headers={"User-Agent": "DataOpsLauncher"})
                with urlopen(req, timeout=2) as resp:
                    if resp.status == 200:
                        self.root.after(0, lambda: self._set_state("running"))
                        self._open_main_window()
                        return
            except Exception:
                pass
            time.sleep(2)
            waited += 2

        if self.server_state == "starting":
            self.root.after(0, lambda: self._set_state("stopped"))
            self.root.after(0, lambda: messagebox.showwarning(
                "启动超时",
                "服务启动超时（60秒），请检查端口是否被占用或查看日志后重试。",
            ))

    # ── pywebview 主窗口 ─────────────────────────────────────────
    def _open_main_window(self):
        """服务就绪后打开 pywebview 窗口，失败则降级到浏览器"""
        if HAS_WEBVIEW and not self._webview_failed:
            threading.Thread(target=self._launch_webview, daemon=True).start()
        else:
            webbrowser.open(URL)

    def _launch_webview(self):
        """在独立线程中启动 pywebview 窗口"""
        try:
            self.webview_window = webview.create_window(
                "数据运维工作台",
                URL,
                width=1280,
                height=800,
                min_size=(800, 600),
                resizable=True,
                text_select=True,
                confirm_close=True,
            )
            # closing event: return False to prevent close, hide instead
            self.webview_window.events.closing += self._on_webview_closing

            webview.start(gui="edgechromium", debug=False)

            # webview.start() returned — window was closed/destroyed
            self.webview_window = None
        except Exception:
            self._webview_failed = True
            self.webview_window = None
            webbrowser.open(URL)

    def _on_webview_closing(self):
        """pywebview 窗口关闭事件 — 最小化到托盘而不退出"""
        if self._quitting:
            return True  # allow close during quit
        # Hide window to tray instead of closing
        if self.webview_window:
            try:
                self.webview_window.hide()
            except Exception:
                pass
        return False  # prevent actual close

    def _show_webview(self):
        """从托盘恢复 pywebview 窗口"""
        if self.webview_window:
            try:
                self.webview_window.show()
                return
            except Exception:
                pass
        # 窗口已关闭或不可用，用浏览器打开
        webbrowser.open(URL)

    # ── 服务停止 ─────────────────────────────────────────────────
    def _stop_service(self):
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            except Exception:
                pass
            self.process = None
        self._set_state("stopped")
        self.start_time = None
        try:
            self.time_label.config(text="—")
            if self.res_label:
                self.res_label.config(text="— / —")
        except Exception:
            pass

    # ── 重启服务 ─────────────────────────────────────────────────
    def _restart_service(self):
        def _do_restart():
            self._stop_service()
            time.sleep(1)
            self.root.after(0, self._start_service)
        threading.Thread(target=_do_restart, daemon=True).start()

    # ── 系统托盘 ─────────────────────────────────────────────────
    def _start_tray(self):
        if not HAS_TRAY:
            return
        try:
            icon_image = _create_icon_image()
            menu = pystray.Menu(
                pystray.MenuItem("打开窗口", self._tray_open_window, default=True),
                pystray.MenuItem("在浏览器中打开", lambda: webbrowser.open(URL)),
                pystray.MenuItem("控制面板", self._show_panel),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("重启服务", lambda: self._restart_service()),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("退出", self._quit_app),
            )
            self.tray_icon = pystray.Icon("dataops", icon_image, "数据运维工作台", menu)
            threading.Thread(target=self.tray_icon.run, daemon=True).start()
        except Exception:
            pass

    def _tray_open_window(self):
        """托盘双击或菜单"打开窗口" — 优先 pywebview，否则浏览器"""
        if HAS_WEBVIEW and self.webview_window and not self._webview_failed:
            self._show_webview()
        else:
            webbrowser.open(URL)

    # ── 控制面板显示/隐藏 ────────────────────────────────────────
    def _show_panel(self, *_args):
        self.root.after(0, self.root.deiconify)
        self.root.after(0, self.root.lift)

    def _hide_panel(self):
        """关闭控制面板窗口 → 隐藏（不退出）"""
        self.root.withdraw()

    # ── 退出 ─────────────────────────────────────────────────────
    def _quit_app(self, *_args):
        """真正退出：停止服务 + 关闭 pywebview + 关闭托盘 + 销毁控制面板"""
        self._quitting = True
        self._monitor_running = False
        self._stop_service()

        # 关闭 pywebview 窗口
        if self.webview_window:
            try:
                self.webview_window.destroy()
            except Exception:
                pass

        if self.tray_icon:
            try:
                self.tray_icon.stop()
            except Exception:
                pass
        try:
            self.root.destroy()
        except Exception:
            pass
        os._exit(0)

    # ── 版本检测 ─────────────────────────────────────────────────
    def _check_for_update(self):
        def _on_new_version(latest: str):
            self.root.after(0, lambda: self._show_update_dialog(latest))
        _check_update(CURRENT_VERSION, _on_new_version)

    def _show_update_dialog(self, latest: str):
        if messagebox.askyesno("发现新版本",
                               f"当前版本 v{CURRENT_VERSION}\n"
                               f"发现新版本 v{latest}，是否前往下载？"):
            webbrowser.open(GITHUB_RELEASES_PAGE)

    # ── 主循环 ───────────────────────────────────────────────────
    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    app = LauncherApp()
    app.run()

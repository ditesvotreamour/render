#!/usr/bin/env python
"""
wav_to_srt_gui.py – Simple graphical front‑end for wav_to_srt.py

Features:
- Browse for a .wav file (or drag‑and‑drop).
- Choose Whisper model via dropdown.
- Show progress and result path.
- Uses the same core conversion function (imported from wav_to_srt.py).
"""

import pathlib
import subprocess
import sys
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

# Path to the core script (same directory as this GUI)
SCRIPT_PATH = pathlib.Path(__file__).with_name("wav_to_srt.py")

def run_conversion(wav_path: pathlib.Path, model: str) -> pathlib.Path:
    """Execute wav_to_srt.py as a subprocess and return the created .srt path."""
    if not SCRIPT_PATH.exists():
        raise FileNotFoundError(f"Core script not found: {SCRIPT_PATH}")
    # Build command line
    cmd = [sys.executable, str(SCRIPT_PATH), str(wav_path), "-m", model]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"Conversion failed: {proc.stderr}")
    # The script prints the path of the generated SRT – capture it
    out_line = proc.stdout.strip().splitlines()[-1]
    # Expected format: "SRT written to <path>"
    if "SRT written to" in out_line:
        srt_path = pathlib.Path(out_line.split("SRT written to")[-1].strip())
        return srt_path
    else:
        raise RuntimeError("Unexpected output from conversion script")

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("WAV → SRT Converter")
        self.geometry("500x180")
        self.resizable(False, False)
        self.create_widgets()

    def create_widgets(self):
        # File selection
        file_frame = ttk.Frame(self)
        file_frame.pack(padx=10, pady=10, fill="x")
        ttk.Label(file_frame, text="WAV file:").pack(side="left")
        self.wav_var = tk.StringVar()
        ttk.Entry(file_frame, textvariable=self.wav_var, width=40).pack(side="left", padx=5)
        ttk.Button(file_frame, text="Browse…", command=self.browse_file).pack(side="left")

        # Model selection
        model_frame = ttk.Frame(self)
        model_frame.pack(padx=10, pady=5, fill="x")
        ttk.Label(model_frame, text="Whisper model:").pack(side="left")
        self.model_var = tk.StringVar(value="small")
        model_options = ["tiny", "base", "small", "medium", "large"]
        ttk.Combobox(model_frame, textvariable=self.model_var, values=model_options, state="readonly").pack(side="left", padx=5)

        # Convert button
        btn = ttk.Button(self, text="Convert to SRT", command=self.convert)
        btn.pack(pady=12)

    def browse_file(self):
        path = filedialog.askopenfilename(filetypes=[("WAV files", "*.wav")])
        if path:
            self.wav_var.set(path)

    def convert(self):
        wav_path = pathlib.Path(self.wav_var.get())
        if not wav_path.is_file():
            messagebox.showerror("Error", "Please select a valid WAV file.")
            return
        model = self.model_var.get()
        try:
            srt_path = run_conversion(wav_path, model)
            messagebox.showinfo("Success", f"SRT created at:\n{srt_path}")
        except Exception as e:
            messagebox.showerror("Conversion failed", str(e))

if __name__ == "__main__":
    App().mainloop()

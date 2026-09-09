#!/usr/bin/env python
"""
wav_to_srt.py – Convert a WAV audio file to an SRT subtitle file using OpenAI Whisper.

Requirements:
- Python 3.9+
- openai-whisper package (`pip install -U openai-whisper`)
- ffmpeg (available in PATH)
"""

import argparse
import pathlib
import whisper

def main() -> None:
    parser = argparse.ArgumentParser(description="Convert WAV to SRT using Whisper")
    parser.add_argument("wav_path", type=pathlib.Path, help="Path to .wav file")
    parser.add_argument(
        "-m",
        "--model",
        default="small",
        help="Whisper model to use (tiny, base, small, medium, large)",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=pathlib.Path,
        default=None,
        help="Output SRT path (default: same name as WAV)",
    )
    args = parser.parse_args()

    wav_path = args.wav_path.resolve()
    if not wav_path.is_file():
        raise FileNotFoundError(f"WAV file not found: {wav_path}")

    model = whisper.load_model(args.model)
    result = model.transcribe(str(wav_path))

    srt_path = args.output or wav_path.with_suffix(".srt")
    with open(srt_path, "w", encoding="utf-8") as f:
        for i, segment in enumerate(result["segments"], start=1):
            start = whisper.format_timestamp(segment["start"])
            end = whisper.format_timestamp(segment["end"])
            text = segment["text"].strip()
            f.write(f"{i}\n{start} --> {end}\n{text}\n\n")
    print(f"SRT written to {srt_path}")

if __name__ == "__main__":
    main()

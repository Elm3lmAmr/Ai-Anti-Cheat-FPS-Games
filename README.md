# SENTRXAI — AI-Based Anti-Cheat Detection System

An intelligent anti-cheat framework for competitive FPS games that detects cheating behavior through AI-powered gameplay telemetry analysis — not memory scanning or signature matching.

Built as a graduation project targeting **AssaultCube** (open-source FPS).

---

## Overview

Traditional anti-cheat systems fail against novel, unknown cheats. SENTRXAI takes a behavioral approach: it analyzes how players move, aim, and engage in combat, then uses machine learning to distinguish legitimate players from cheaters — even cheating techniques it has never seen before.

---

## Repository Structure

```
├── assaultcube/          # AssaultCube game client + source code
│   ├── Game/             # Game binaries (ac_client.exe), assets, maps
│   ├── Game/source/      # Full C++ source code
│   └── ffmpeg/           # ffmpeg binaries for kill replay recording
├── Desktop app (2)/      # WPF desktop monitoring application (main version)
├── desktop-part/         # Alternate WPF app structure
└── README.md
```

---

## System Architecture

```
Game Client (AssaultCube)
        │
        ▼
  External Hook (DLL)          ← captures real-time game state
        │
        ▼
  Telemetry Collector           ← position, aim, speed, health @ ~20Hz
        │
        ▼
  Feature Extractor             ← 200ms sliding window features
        │
        ▼
  AI Inference Engine           ← 11 models across 4 paradigms
        │
        ▼
  SENTRXAI Dashboard (WPF)      ← admin alerts, reports, player history
```

---

## AI Models

SENTRXAI implements 11 models across four paradigms:

### Traditional Machine Learning
| Model | Approach |
|---|---|
| Logistic Regression | Linear decision boundary on behavioral features |
| Support Vector Machine | RBF kernel for non-linear separation |
| K-Nearest Neighbors | Similarity-based classification (k=5) |
| Random Forest | Ensemble of decision trees |
| XGBoost | Gradient boosted trees |

### Deep Learning
| Model | Approach |
|---|---|
| MLP | Feedforward network on per-window feature vectors |
| LSTM | Sequence modeling over 10-step temporal windows |
| CNN (1D) | Convolutional pattern detection over time series |

### Generative / Anomaly Detection
| Model | Approach |
|---|---|
| VAE | Trained on legit-only data; flags high reconstruction error |
| Diffusion Model | Denoising-based behavioral anomaly detection |

### Reinforcement Learning
| Model | Approach |
|---|---|
| DQN | Binary classification agent (legit / cheat) |

The VAE and Diffusion models are particularly significant: they detect cheating as anomalous behavior without requiring labeled cheat data, enabling generalization to **unseen cheating techniques**.

---

## Telemetry Features

Raw game state is captured at ~20Hz and aggregated into 200ms windows:

| Category | Features |
|---|---|
| Position | `playerPosX`, `playerPosY`, `playerPosZ` |
| Aim | `aimYawSpeed`, `aimPitchSpeed`, `deltaYaw`, `deltaPitch` |
| Movement | `moveSpeed`, `isOnGround` |
| Combat | `isShooting`, `weaponId`, `health` |
| Spatial | `distanceToNearestEnemy` |

---

## Desktop Application

The **SENTRXAI Dashboard** is a WPF application providing:

- Real-time player monitoring during matches
- Cheat detection alerts with confidence scores
- Report submission and case management
- Match history and behavioral timelines
- Admin review workflow

---

## Dataset

Gameplay data was collected from real AssaultCube sessions using the game hook pipeline:

- **Telemetry:** ~146,000+ frame-level records across multiple players
- **Events:** Kill, death, and headshot events with timestamps
- **Matches:** Match metadata with map, weapon, and session info
- **Video:** Kill replay recordings linked to match IDs (MP4)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Game Client | AssaultCube (C++, open-source FPS) |
| Hook / Telemetry | C++ External DLL |
| ML / DL | Python, scikit-learn, PyTorch |
| Desktop App | C#, WPF (.NET) |
| Video Recording | ffmpeg |

---

## Project Context

This system was developed as a Computer Science graduation project investigating:

- Can machine learning detect cheating from gameplay telemetry alone?
- Which AI paradigm performs best for anti-cheat detection?
- Can generative models identify previously unseen cheating techniques?
- How do behavioral features rank in importance for cheat detection?

---

## Team

Graduation project — Computer Science Department, 2026.

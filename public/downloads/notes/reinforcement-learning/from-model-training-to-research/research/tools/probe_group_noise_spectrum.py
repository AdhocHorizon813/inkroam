"""Exact finite-group algebra probe, not a training or benchmark experiment.

Enumerate binary reward groups, invert an independent symmetric bit-flip
channel using a Walsh transform, and check conditional unbiasedness. The
target is one coordinate of the clean, population-std-normalized advantage;
all-equal groups receive zero advantage. Conditioning fixes the generated
responses; labels alone are noisy. This deliberately strong target is distinct
from an on-policy population policy-gradient identity.
"""

import json
from pathlib import Path

import numpy as np


def walsh(values):
    result = np.array(values, dtype=np.float64, copy=True)
    width = 1
    while width < result.size:
        blocks = result.reshape(-1, 2 * width)
        left = blocks[:, :width].copy()
        right = blocks[:, width:].copy()
        blocks[:, :width] = left + right
        blocks[:, width:] = left - right
        width *= 2
    return result


def probe(group_size, eta):
    size = 1 << group_size
    counts = np.fromiter((i.bit_count() for i in range(size)), dtype=np.int32)
    fraction = counts / group_size
    first = (np.arange(size, dtype=np.uint32) & 1).astype(np.float64)
    clean = np.zeros(size)
    mixed = (counts > 0) & (counts < group_size)
    clean[mixed] = (first[mixed] - fraction[mixed]) / np.sqrt(
        fraction[mixed] * (1 - fraction[mixed])
    )
    coeff = walsh(clean) / size
    kappa = 1 - 2 * eta
    inverse_coeff = coeff / np.power(kappa, counts)
    estimate = walsh(inverse_coeff)
    conditional_mean = walsh((walsh(estimate) / size) * np.power(kappa, counts))
    residual = float(np.max(np.abs(conditional_mean - clean)))
    if residual > 1e-7:
        raise AssertionError(f"Channel inversion residual: {residual}")
    clean_energy = float(np.mean(clean**2))
    inverse_energy = float(np.mean(estimate**2))
    # A uniform latent group stays uniform under symmetric bit flips.
    # Thus this is an exact conditional-noise variance averaged over uniform groups.
    result = {
        "K": group_size,
        "eta": eta,
        "target_second_moment_under_uniform_groups": clean_energy,
        "unbiased_estimator_second_moment_under_uniform_groups": inverse_energy,
        "second_moment_ratio": inverse_energy / clean_energy,
        "mean_conditional_noise_variance_under_uniform_groups": inverse_energy - clean_energy,
        "conditional_unbiasedness_max_abs_residual": residual,
        "spectral_energy_by_degree": np.bincount(counts, weights=coeff**2).tolist(),
    }
    approximations = []
    for degree in (1, 3, 5):
        if degree > group_size:
            continue
        keep = counts <= degree
        low_clean = walsh(coeff * keep)
        low_estimate = walsh(inverse_coeff * keep)
        approximations.append({
            "degree": degree,
            "worst_case_conditional_bias": float(np.max(np.abs(low_clean - clean))),
            "mean_squared_conditional_bias_under_uniform_groups": float(np.mean((low_clean - clean)**2)),
            "estimator_second_moment_under_uniform_groups": float(np.mean(low_estimate**2)),
        })
    result["degree_truncations"] = approximations
    return result


if __name__ == "__main__":
    output = Path(__file__).resolve().parents[1] / "results" / "group_noise_spectrum.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    results = [probe(k, eta) for k in (2, 4, 8, 12, 16) for eta in (0.1, 0.2, 0.3)]
    output.write_text(json.dumps({
        "scope": "Exact enumeration in float64; not training, not a novelty result, not a policy-gradient lower bound.",
        "target": "One coordinate of binary, population-std group advantage, zero on all-equal groups.",
        "noise": "Known independent symmetric bit flips; one noisy label per response.",
        "results": results,
    }, indent=2) + "\n", encoding="utf-8")
    print("K eta second_moment_ratio max_conditional_residual")
    for row in results:
        print(row["K"], row["eta"], f'{row["second_moment_ratio"]:.6g}',
              f'{row["conditional_unbiasedness_max_abs_residual"]:.3g}')
    print(output)

#!/usr/bin/env bash
#
# install-cosign.sh — put a PINNED cosign on PATH without the third-party hop
# that has wedged this fleet's builds.
#
# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS EXISTS
#
#   `sigstore/cosign-installer` downloads the binary and its `.sig` from the
#   GitHub RELEASES host — which is fine — and then fetches the verification key
#   from `raw.githubusercontent.com/sigstore/cosign/<tag>/release/release-cosign.pub`.
#   That host rate-limits. Measured 2026-08-17: a persistent HTTP 429 from
#   `x-github-edge-region: fra`, the runners' region, killed the step with curl
#   exit 22 on EVERY carved repo and submodule at once — including repos whose
#   own CI passed in the same push, which is the tell that it is not the code.
#   Nothing in any repository fixes it and re-running before it clears just
#   burns another run.
#
# ─────────────────────────────────────────────────────────────────────────────
# WHAT THIS DOES INSTEAD
#
#   Downloads the binary from the releases host and verifies it against a
#   sha256 PINNED HERE, taken from that release's own `cosign_checksums.txt`.
#   Integrity without the key fetch: one hop instead of two, and the hop that
#   remains is the one that was never rate-limited.
#
#   It is NOT a weaker check. The installer verifies a signature made by a key
#   it fetches over plain HTTPS from the same origin as the artifact; pinning
#   the digest in a reviewed file binds the bytes to something an attacker
#   would have to change IN THIS REPOSITORY, in a diff, to move.
#
#   Bumping cosign means editing two lines here — the version and the digests —
#   and the digests come from the release's checksums file. A mismatch is a hard
#   failure, never a warning: an unverified cosign is not a verifier.
set -euo pipefail

COSIGN_VERSION='v2.6.5'

# From https://github.com/sigstore/cosign/releases/download/v2.6.5/cosign_checksums.txt
COSIGN_SHA256_AMD64='c3b4f5410e608af03a5eb0aaac84a4313d8da131248e08ff1759ac70c79d1644'
COSIGN_SHA256_ARM64='426193b4c5da4d4d643e822f48fe0cc8a476ca1782a272704831f5a0cef716d7'

# ONE hashing implementation, used by the download check below, so one digest
# decides. No hasher at all is a REFUSAL, not a skip: a cosign whose bytes
# nothing here can check is not a verifier.
sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    echo "install-cosign: neither sha256sum nor shasum is on PATH, so the pinned digest cannot be checked. Refusing — an unverified cosign is not a verifier." >&2
    exit 1
  fi
}

# An unsupported platform has no pin (`want` stays empty) and is refused
# further down, at the point of install.
os="$(uname -s)"
arch="$(uname -m)"
want=''
asset=''
case "${os}:${arch}" in
  Linux:x86_64)              asset='cosign-linux-amd64'; want="${COSIGN_SHA256_AMD64}" ;;
  Linux:aarch64|Linux:arm64) asset='cosign-linux-arm64'; want="${COSIGN_SHA256_ARM64}" ;;
esac

# There is deliberately NO shortcut for a cosign found on PATH: the
# pinned build is always downloaded and its sha256 checked below. A cosign
# found on PATH (a baked runner image, a planted binary) is never trusted.

if [ -z "${want}" ]; then
  # Every runner here is linux/amd64 or linux/arm64. Refusing here
  # rather than adding untested darwin/windows paths: machinery with no
  # consumer is machinery that is wrong the first time someone needs it.
  #
  # A cosign ALREADY on PATH does not rescue this. There is no pinned digest
  # for this platform, so there is nothing to check those bytes against, and
  # reporting success would be this script vouching for a binary it cannot
  # recognise.
  echo "install-cosign: unsupported runner ${os}/${arch}. Only Linux x86_64/aarch64 are pinned, so no digest here can vouch for a cosign on this platform." >&2
  exit 1
fi

dest_dir="${RUNNER_TEMP:-/tmp}/cosign-bin"
mkdir -p "${dest_dir}"
tmp="${dest_dir}/.cosign.download"
url="https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/${asset}"

# No retry: a failed download fails the step.
curl --fail --location --silent --show-error \
  --connect-timeout 15 --max-time 300 --output "${tmp}" "${url}"

got="$(sha256_of "${tmp}")"

if [ "${got}" != "${want}" ]; then
  rm -f "${tmp}"
  echo "install-cosign: sha256 mismatch for ${asset} — refusing to install." >&2
  echo "  expected ${want}" >&2
  echo "  got      ${got}" >&2
  echo "  If cosign ${COSIGN_VERSION} was re-released, update the digests in this file from that release's cosign_checksums.txt." >&2
  exit 1
fi

chmod 0755 "${tmp}"
mv "${tmp}" "${dest_dir}/cosign"

if [ -n "${GITHUB_PATH:-}" ]; then
  echo "${dest_dir}" >> "${GITHUB_PATH}"
fi
export PATH="${dest_dir}:${PATH}"

echo "install-cosign: installed ${asset} ${COSIGN_VERSION} (sha256 ${want}) at ${dest_dir}/cosign."

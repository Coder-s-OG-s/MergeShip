#  AI Usage Policy - MergeShip

MergeShip supports the use of AI tools (like GitHub Copilot, ChatGPT, or Claude) to enhance productivity. However, to maintain the quality of our open-source orchestration platform, all contributors must follow these guidelines.

---

##  Rules for AI Usage

### 1. Human Oversight (Mandatory)
* **Code Understanding:** You are 100% responsible for the code you submit. You must be able to explain every line of your Pull Request (PR).
* **No Blind Copy-Paste:** AI-generated code often includes hallucinations or outdated patterns. Manual review and testing are mandatory.

### 2. Transparency & Disclosure
* When opening a Pull Request, you **must** disclose if AI was used.
* Mention the tool name (e.g., "Assisted by GitHub Copilot") in the PR description.

### 3. Quality Control
* **No AI Spam:** PRs that are clearly 100% AI-generated without logic or proper context will be closed immediately.
* **Security Check:** Ensure AI doesn't introduce security vulnerabilities or hardcoded credentials.

### 4. Licensing & Ethics
* Ensure that the AI-generated code does not violate any third-party licenses. 
* Keep the code style consistent with the existing MergeShip codebase.

---

## Consequences of Policy Violation

Failure to disclose AI usage or submitting low-quality AI-generated code carries a **3-strike system**:

| Strike | What happens |
|--------|-------------|
| **1st warning** | PR is closed - maintainer leaves a comment explaining the violation |
| **2nd warning** | PR is closed - formal warning issued, contributor is flagged |
| **3rd warning** | Permanent ban from contributing to MergeShip |

- Warnings are tracked per GitHub handle across all PRs
- A warning is issued for: undisclosed AI usage, submitting code you cannot explain, copy-pasted AI output with no review or testing
- There is no expiry - warnings do not reset after time
- Appeals can be raised in [GitHub Discussions](https://github.com/Coder-s-OG-s/MergeShip/discussions) under the `Appeals` category

---
[← Back to Contributing Guidelines](../CONTRIBUTING.md)

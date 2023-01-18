# Change Log

# 0.0.3
- Bugfixes
  - No longer multiple encryption/decryption terminals opening for a single file
  - When editing an encrypted file directly, closing it and then opening again 'normally', it now opens the decrypted TMP version again
- Efficiency
  - One central encryption terminal for all TMP files
  - Every eventlistener added exactly once
    - And now nicely disposed
- Backend
  - Heavy refactoring


## 0.0.2
Initial release
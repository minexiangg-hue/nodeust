#!/usr/bin/env python3
"""Enter a Gmail app password locally; never put it in command arguments."""
import getpass
import os
from pathlib import Path
import re
import sys
import tempfile


def main():
    if not sys.stdin.isatty():
        raise SystemExit('Run in your interactive server terminal; do not pipe a password.')
    target = Path('/home/ubuntu/nodeust-backups/20260916T183515Z-before-email-auth/mail-pending.env')
    if target.is_symlink() or not target.is_file():
        raise SystemExit('Protected pending mail configuration is missing.')
    source = target.read_text()
    if 'NODE_EMAIL_SMTP_HOST=smtp.gmail.com' not in source:
        raise SystemExit('This helper is only for the pending Gmail configuration.')
    password = getpass.getpass('Gmail application password (hidden): ').replace(' ', '')
    if not re.fullmatch(r'[A-Za-z0-9]{16}', password):
        raise SystemExit('Expected the 16-character application password; no changes made.')
    lines = [line for line in source.splitlines()
             if not line.startswith('NODE_EMAIL_SMTP_PASSWORD=')]
    fd, temporary = tempfile.mkstemp(prefix='.mail-', dir=target.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write('\n'.join(lines) + '\nNODE_EMAIL_SMTP_PASSWORD=' + password + '\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, target)
    finally:
        Path(temporary).unlink(missing_ok=True)
    print('Saved protected pending SMTP configuration. No mail sent; production unchanged.')


if __name__ == '__main__':
    main()

# TLE date fallback debugging criterion

`2026-07-27T20:00` in Asia/Taipei must publish a complete Starlink two-hour
run instead of failing because one catalog record cannot be propagated. The
accepted time must remain the requested time whenever the remaining validated
catalog still yields a complete NTPU-visible run. If a complete scene cannot be
built, a bounded nearest-time fallback must expose both requested and accepted
times.


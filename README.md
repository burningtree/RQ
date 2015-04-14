# RQ: Better living through asynchronicity

Douglas Crockford
2013-06-21

## Introduction

Turn based servers are now joining turn based browsers in providing race-free
and deadlock-free interactivity. The event-driven model has long been popular
in UI systems, but the nature of work in servers presents some new challenges.
Functional programming provides solutions, including monads, arrows, promises,
and various flavors of FRP. This is another such solution, intended to enhance
ease of use for tasks which are common to server applications by providing
support of sequences, parallel operations, with timeouts and cancellations.

## Installation

```
$ npm install async-rq
```

## Usage

See [help.md](help.md).


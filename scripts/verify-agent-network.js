#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = [
  'functions/api/agent-network.js',
  'functions/api/agent-network-admin.js',
  'functions/_agent-finance.js',
  'functions/api/orders.js',
  'functions/api/partner.js',
  'functions/media/agent/[id].js'
];
let failed = false;
for (const relative of files) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) {
    console.error('FAIL missing:', relative);
    failed = true;
    continue;
  }
  const result = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: fs.readFileSync(file, 'utf8'),
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    console.error('FAIL syntax:', relative, result.stderr || result.stdout);
    failed = true;
  } else {
    console.log('PASS syntax:', relative);
  }
}
const api = fs.readFileSync(path.join(root, 'functions/api/agent-network.js'), 'utf8');
if (!api.includes("status='delivered'") ||
    !api.includes("status IN ('available','paid')")) {
  console.error('FAIL public profile stats must show delivered sales and approved earnings only.');
  failed = true;
} else {
  console.log('PASS public profile stats use verified sales and approved earnings.');
}
const admin = fs.readFileSync(path.join(root, 'functions/api/agent-network-admin.js'), 'utf8');
for (const [label, token] of [
  ['admin session protection', 'getAdminSession(request,env)'],
  ['delivered-order commission gate', 'order.status!=="delivered"'],
  ['payout allocation ledger', 'agent_payout_allocations'],
  ['delivery confirmation state', "fulfilment_status='confirmed'"],
  ['delivery report prerequisite', 'fulfilment_status!=="delivery_reported"'],
  ['cancelled-order protection', 'order.status==="cancelled"'],
  ['admin confirmation action', 'fulfilment.confirm'],
  ['delivery audit event', 'agent_delivery_confirmed'],
  ['agent delivery notification', 'delivery-confirmed:']
]) {
  if (!admin.includes(token)) {
    console.error('FAIL missing:', label);
    failed = true;
  } else console.log('PASS', label);
}
if (failed) process.exit(1);
console.log('PhoneYa2 Agent Network verification passed.');

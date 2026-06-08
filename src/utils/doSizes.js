const DO_SIZES = [
  { slug: 's-1vcpu-512mb-10gb', vcpus: 1, ram: 512, disk: 10, transfer: 0.5, tier: 'Basic' },
  { slug: 's-1vcpu-1gb',        vcpus: 1, ram: 1024, disk: 25, transfer: 1, tier: 'Basic' },
  { slug: 's-1vcpu-1gb-amd',    vcpus: 1, ram: 1024, disk: 25, transfer: 1, tier: 'Premium AMD' },
  { slug: 's-1vcpu-1gb-intel',  vcpus: 1, ram: 1024, disk: 25, transfer: 1, tier: 'Premium Intel' },
  { slug: 's-1vcpu-2gb',        vcpus: 1, ram: 2048, disk: 50, transfer: 2, tier: 'Basic' },
  { slug: 's-1vcpu-2gb-amd',    vcpus: 1, ram: 2048, disk: 50, transfer: 2, tier: 'Premium AMD' },
  { slug: 's-1vcpu-2gb-intel',  vcpus: 1, ram: 2048, disk: 50, transfer: 2, tier: 'Premium Intel' },
  { slug: 's-2vcpu-2gb',        vcpus: 2, ram: 2048, disk: 60, transfer: 3, tier: 'Basic' },
  { slug: 's-2vcpu-2gb-amd',    vcpus: 2, ram: 2048, disk: 60, transfer: 3, tier: 'Premium AMD' },
  { slug: 's-2vcpu-2gb-intel',  vcpus: 2, ram: 2048, disk: 60, transfer: 3, tier: 'Premium Intel' },
  { slug: 's-2vcpu-4gb',        vcpus: 2, ram: 4096, disk: 80, transfer: 4, tier: 'Basic' },
  { slug: 's-2vcpu-4gb-amd',    vcpus: 2, ram: 4096, disk: 80, transfer: 4, tier: 'Premium AMD' },
  { slug: 's-2vcpu-4gb-intel',  vcpus: 2, ram: 4096, disk: 80, transfer: 4, tier: 'Premium Intel' },
  { slug: 's-4vcpu-8gb',        vcpus: 4, ram: 8192, disk: 160, transfer: 5, tier: 'Basic' },
  { slug: 's-4vcpu-8gb-amd',    vcpus: 4, ram: 8192, disk: 160, transfer: 5, tier: 'Premium AMD' },
  { slug: 's-4vcpu-8gb-intel',  vcpus: 4, ram: 8192, disk: 160, transfer: 5, tier: 'Premium Intel' },
  { slug: 's-8vcpu-16gb',       vcpus: 8, ram: 16384, disk: 320, transfer: 6, tier: 'Basic' },
  { slug: 'g-2vcpu-8gb',        vcpus: 2, ram: 8192, disk: 25, transfer: 3, tier: 'General Purpose' },
  { slug: 'g-4vcpu-16gb',       vcpus: 4, ram: 16384, disk: 50, transfer: 4, tier: 'General Purpose' },
  { slug: 'g-8vcpu-32gb',       vcpus: 8, ram: 32768, disk: 100, transfer: 5, tier: 'General Purpose' },
  { slug: 'm-2vcpu-16gb',       vcpus: 2, ram: 16384, disk: 50, transfer: 3, tier: 'Memory' },
  { slug: 'm-4vcpu-32gb',       vcpus: 4, ram: 32768, disk: 100, transfer: 4, tier: 'Memory' },
  { slug: 'm-8vcpu-64gb',       vcpus: 8, ram: 65536, disk: 200, transfer: 5, tier: 'Memory' },
  { slug: 'c-2-4vcpu-8gb',      vcpus: 4, ram: 8192, disk: 25, transfer: 4, tier: 'CPU-Optimized' },
  { slug: 'c-4-8vcpu-16gb',     vcpus: 8, ram: 16384, disk: 50, transfer: 5, tier: 'CPU-Optimized' },
];

function formatSizeTable() {
  const groups = {};
  for (const s of DO_SIZES) {
    const g = `${s.vcpus} vCPU`;
    if (!groups[g]) groups[g] = [];
    const ramStr = s.ram >= 1024 ? (s.ram / 1024) + 'GB' : s.ram + 'MB';
    groups[g].push(`\`${String(s.vcpus)} vCPU | ${ramStr.padStart(5)} | ${String(s.disk).padStart(3)}GB | ${String(s.transfer).padStart(3)}TB\`  ${s.tier}`);
  }
  return Object.entries(groups).map(([g, items]) => `\n${g}:\n${items.join('\n')}`).join('');
}

function getSizeBySlug(slug) {
  return DO_SIZES.find(s => s.slug === slug);
}

module.exports = { DO_SIZES, formatSizeTable, getSizeBySlug };

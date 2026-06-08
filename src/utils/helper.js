function sanitize(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>"'&]/g, '').trim();
}

function parseNumber(value) {
  const num = parseInt(value, 10);
  return isNaN(num) ? null : num;
}

function escapeMarkdown(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}!]/g, '\\$&');
}

module.exports = { sanitize, parseNumber, escapeMarkdown };

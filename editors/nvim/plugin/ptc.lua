-- pb2-trigger-compiler: filetypes and language server for .ptc and .pasm.
-- Add this folder to the runtime path, e.g. vim.opt.rtp:append('/path/to/pb2-trigger-compiler/editors/nvim')
if vim.g.loaded_ptc then
  return
end
vim.g.loaded_ptc = true

local root = vim.fn.fnamemodify(debug.getinfo(1, 'S').source:sub(2), ':p:h:h:h:h')

vim.filetype.add({ extension = { ptc = 'ptc', pasm = 'pasm' } })

if vim.lsp.config then
  vim.lsp.config('ptc_lsp', {
    cmd = { 'node', root .. '/bin/ptc-lsp.js', '--stdio' },
    filetypes = { 'ptc', 'pasm' },
    root_markers = { '.git' },
  })
  vim.lsp.enable('ptc_lsp')
end

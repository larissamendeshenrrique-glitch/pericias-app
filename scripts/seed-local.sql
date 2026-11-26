-- Dados SÓ para teste local (wrangler dev --local). Nunca usar em produção.
INSERT OR IGNORE INTO usuarios (id, nome, email) VALUES (1, 'Larissa Teste', 'teste@exemplo.local');
INSERT OR IGNORE INTO convites (usuario_id, token_hash, tipo, expira_em)
  VALUES (1, '1eecce64336141571f4575dce2fdabc8948aee711f9037f6e63b1fd1c11a622e', 'primeiro_acesso', '2099-01-01T00:00:00Z');

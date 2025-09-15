use zed_extension_api::{self as zed, Result};

struct CassandraOrmExtension;

impl zed::Extension for CassandraOrmExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &zed::LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        Ok(zed::Command {
            command: "node".to_string(),
            args: vec![
                "node_modules/.bin/typescript-language-server".to_string(),
                "--stdio".to_string(),
            ],
            env: Default::default(),
        })
    }
}

zed::register_extension!(CassandraOrmExtension);

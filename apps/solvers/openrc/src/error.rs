use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OpenRcError {
    FileNotFound(String),
    InvalidValue(String),
    MissingKey(String),
    ConfigSyntax(String),
    Json(String),
    Io(String),
    ZeroDivision(String),
    OutOfRange(String),
    InvalidType(String),
}

impl OpenRcError {
    pub fn message(&self) -> &str {
        match self {
            OpenRcError::FileNotFound(message)
            | OpenRcError::InvalidValue(message)
            | OpenRcError::MissingKey(message)
            | OpenRcError::ConfigSyntax(message)
            | OpenRcError::Json(message)
            | OpenRcError::Io(message)
            | OpenRcError::ZeroDivision(message)
            | OpenRcError::OutOfRange(message)
            | OpenRcError::InvalidType(message) => message,
        }
    }

    pub fn kind(&self) -> &'static str {
        match self {
            OpenRcError::FileNotFound(_) => "FileNotFound",
            OpenRcError::InvalidValue(_) => "InvalidValue",
            OpenRcError::MissingKey(_) => "MissingKey",
            OpenRcError::ConfigSyntax(_) => "ConfigSyntax",
            OpenRcError::Json(_) => "Json",
            OpenRcError::Io(_) => "Io",
            OpenRcError::ZeroDivision(_) => "ZeroDivision",
            OpenRcError::OutOfRange(_) => "OutOfRange",
            OpenRcError::InvalidType(_) => "InvalidType",
        }
    }
}

impl fmt::Display for OpenRcError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.message())
    }
}

impl std::error::Error for OpenRcError {}

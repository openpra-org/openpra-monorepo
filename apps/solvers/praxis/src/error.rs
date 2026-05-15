use std::fmt;

pub type Result<T> = std::result::Result<T, PraxisError>;

#[derive(Debug, Clone, PartialEq)]
pub enum PraxisError {
    Io(String),
    DynamicLibrary(String),
    Logic(String),
    IllegalOperation(String),
    Settings(String),
    Version(String),
    Serialization(String),
    Mef(MefError),
    Xml(XmlError),
}

#[derive(Debug, Clone, PartialEq)]
pub enum MefError {
    Validity(String),
    DuplicateElement {
        element_id: String,
        element_type: String,
        container_id: Option<String>,
    },
    UndefinedElement {
        reference: String,
        element_type: String,
    },
    Cycle { cycle_path: String },
    Domain {
        message: String,
        value: Option<String>,
        attribute: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum XmlError {
    Parse {
        message: String,
        element: Option<String>,
    },
    XInclude(String),
    Validity {
        message: String,
        element: Option<String>,
        attribute: Option<String>,
    },
}

impl fmt::Display for PraxisError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PraxisError::Io(msg) => write!(f, "I/O Error: {}", msg),
            PraxisError::DynamicLibrary(msg) => write!(f, "Dynamic Library Error: {}", msg),
            PraxisError::Logic(msg) => write!(f, "Logic Error: {}", msg),
            PraxisError::IllegalOperation(msg) => write!(f, "Illegal Operation: {}", msg),
            PraxisError::Settings(msg) => write!(f, "Settings Error: {}", msg),
            PraxisError::Version(msg) => write!(f, "Version Error: {}", msg),
            PraxisError::Serialization(msg) => write!(f, "Serialization Error: {}", msg),
            PraxisError::Mef(err) => write!(f, "MEF Error: {}", err),
            PraxisError::Xml(err) => write!(f, "XML Error: {}", err),
        }
    }
}

impl fmt::Display for MefError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            MefError::Validity(msg) => write!(f, "Validity Error: {}", msg),
            MefError::DuplicateElement {
                element_id,
                element_type,
                container_id,
            } => {
                if let Some(container) = container_id {
                    write!(
                        f,
                        "Duplicate Element Error: {} '{}' already exists in container '{}'",
                        element_type, element_id, container
                    )
                } else {
                    write!(
                        f,
                        "Duplicate Element Error: {} '{}' already exists",
                        element_type, element_id
                    )
                }
            }
            MefError::UndefinedElement {
                reference,
                element_type,
            } => {
                write!(
                    f,
                    "Undefined Element Error: {} '{}' not found",
                    element_type, reference
                )
            }
            MefError::Cycle { cycle_path } => {
                write!(f, "Cycle Error: {}", cycle_path)
            }
            MefError::Domain {
                message,
                value,
                attribute,
            } => {
                let mut msg = format!("Domain Error: {}", message);
                if let Some(val) = value {
                    msg.push_str(&format!(" (value: {})", val));
                }
                if let Some(attr) = attribute {
                    msg.push_str(&format!(" (attribute: {})", attr));
                }
                write!(f, "{}", msg)
            }
        }
    }
}

impl fmt::Display for XmlError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            XmlError::Parse { message, element } => {
                if let Some(elem) = element {
                    write!(f, "XML Parse Error in element '{}': {}", elem, message)
                } else {
                    write!(f, "XML Parse Error: {}", message)
                }
            }
            XmlError::XInclude(msg) => write!(f, "XInclude Error: {}", msg),
            XmlError::Validity {
                message,
                element,
                attribute,
            } => {
                let mut msg = format!("XML Validity Error: {}", message);
                if let Some(elem) = element {
                    msg.push_str(&format!(" (element: {})", elem));
                }
                if let Some(attr) = attribute {
                    msg.push_str(&format!(" (attribute: {})", attr));
                }
                write!(f, "{}", msg)
            }
        }
    }
}

impl std::error::Error for PraxisError {}
impl std::error::Error for MefError {}
impl std::error::Error for XmlError {}

// Conversion from std::io::Error
impl From<std::io::Error> for PraxisError {
    fn from(err: std::io::Error) -> Self {
        PraxisError::Io(err.to_string())
    }
}

// Conversion from MefError
impl From<MefError> for PraxisError {
    fn from(err: MefError) -> Self {
        PraxisError::Mef(err)
    }
}

impl From<quick_xml::Error> for PraxisError {
    fn from(err: quick_xml::Error) -> Self {
        PraxisError::Io(format!("XML error: {}", err))
    }
}

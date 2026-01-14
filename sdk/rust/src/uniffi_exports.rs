// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

use std::sync::Arc;
use uniffi::prelude::*;

// Re-export all types for FFI
pub use crate::types::api::*;
pub use crate::types::error::*;
pub use crate::utils::connection::*;
pub use crate::utils::http::*;
pub use crate::utils::retry::*;
pub use crate::managers::*;
pub use crate::{MessagePriority, ChannelType, EncryptionAlgorithm, ConnectionState};

// Include the generated scaffolding
uniffi::include_scaffolding!("securenotify");

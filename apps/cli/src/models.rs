use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct Context {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct InboxStuff {
    pub id: String,
    pub title: String,
    pub status: String,
}

#[derive(Debug, Deserialize)]
pub struct Stuff {
    pub id: String,
    pub title: String,
    pub body: ItemBody,
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(rename = "projectTitle")]
    pub project_title: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ItemBody {
    pub text: String,
    #[serde(rename = "inlineMarks", default)]
    pub inline_marks: Vec<serde_json::Value>,
    #[serde(rename = "lineBlocks", default)]
    pub line_blocks: Vec<serde_json::Value>,
    #[serde(rename = "blockEntities", default)]
    pub block_entities: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct UpdateTitleRequest<'a> {
    pub title: &'a str,
}

#[derive(Debug, Serialize)]
pub struct UpdateBodyRequest {
    pub body: ItemBody,
}

#[derive(Debug, Serialize)]
pub struct NextActionRequest<'a> {
    pub energy: f64,
    #[serde(rename = "estimatedTime")]
    pub estimated_time: EstimatedTime,
    #[serde(rename = "contextIds")]
    pub context_ids: &'a [String],
    pub deadline: Option<&'a str>,
}

#[derive(Debug, Serialize)]
pub struct EstimatedTime {
    pub hours: u32,
    pub minutes: u32,
}

#[derive(Debug, Serialize)]
pub struct ProjectRequest<'a> {
    pub deadline: Option<&'a str>,
}

#[derive(Debug, Serialize)]
pub struct CalendarRequest<'a> {
    #[serde(rename = "scheduledDate")]
    pub scheduled_date: &'a str,
    #[serde(rename = "scheduledTime")]
    pub scheduled_time: Option<&'a str>,
}

impl ItemBody {
    pub fn markdown(text: String) -> Self {
        Self { text, inline_marks: vec![], line_blocks: vec![], block_entities: vec![] }
    }
}

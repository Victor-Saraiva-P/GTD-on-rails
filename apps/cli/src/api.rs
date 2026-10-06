use reqwest::blocking::{Client, Response};
use reqwest::Method;
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::time::Duration;
use url::Url;

use crate::error::CliError;
use crate::models::{
    CalendarRequest, Context, InboxStuff, NextActionRequest, ProjectRequest, Stuff, UpdateBodyRequest,
    UpdateTitleRequest,
};

pub struct ApiClient {
    base_url: Url,
    client: Client,
}

impl ApiClient {
    /// Creates a client for one GTD on Rails API endpoint.
    ///
    /// Example: `ApiClient::new("http://127.0.0.1:8080".to_string())`.
    pub fn new(base_url: String) -> Result<Self, CliError> {
        let mut parsed = Url::parse(&base_url).map_err(|_| CliError::InvalidApiUrl(base_url.clone()))?;
        if !matches!(parsed.scheme(), "http" | "https") {
            return Err(CliError::InvalidApiUrl(base_url));
        }
        ensure_trailing_slash(&mut parsed);
        let client = Client::builder().timeout(Duration::from_secs(15)).build()?;
        Ok(Self { base_url: parsed, client })
    }

    /// Lists active inbox stuff without loading each Markdown body.
    ///
    /// Example: `client.list_stuff()`.
    pub fn list_stuff(&self) -> Result<Vec<InboxStuff>, CliError> {
        self.get_json("inbox")
    }

    /// Lists active next-action contexts for processing decisions.
    ///
    /// Example: `client.list_contexts()`.
    pub fn list_contexts(&self) -> Result<Vec<Context>, CliError> {
        self.get_json("contexts")
    }

    /// Loads one active stuff item with its canonical Markdown body.
    ///
    /// Example: `client.get_stuff("018f13b2-a7f3-7c44-8f1a-9f31f65a7fd2")`.
    pub fn get_stuff(&self, id: &str) -> Result<Stuff, CliError> {
        self.get_json(&format!("inbox/{id}"))
    }

    /// Updates the title of an item already verified as active stuff.
    ///
    /// Example: `client.update_stuff_title(id, &request)`.
    pub fn update_stuff_title(&self, id: &str, request: &UpdateTitleRequest<'_>) -> Result<(), CliError> {
        self.send_json(Method::PATCH, &format!("items/{id}/title"), request)
    }

    /// Replaces the Markdown body of an item already verified as active stuff.
    ///
    /// Example: `client.update_stuff_body(id, &request)`.
    pub fn update_stuff_body(&self, id: &str, request: &UpdateBodyRequest) -> Result<(), CliError> {
        self.send_json(Method::PATCH, &format!("items/{id}/body"), request)
    }

    /// Converts active stuff into a next action through the domain endpoint.
    ///
    /// Example: `client.process_next_action(id, &request)`.
    pub fn process_next_action(&self, id: &str, request: &NextActionRequest<'_>) -> Result<(), CliError> {
        self.send_json(Method::POST, &format!("inbox/{id}/next-action"), request)
    }

    /// Converts active stuff into a project through the domain endpoint.
    ///
    /// Example: `client.process_project(id, &request)`.
    pub fn process_project(&self, id: &str, request: &ProjectRequest<'_>) -> Result<(), CliError> {
        self.send_json(Method::POST, &format!("inbox/{id}/project"), request)
    }

    /// Converts active stuff into someday/maybe through the domain endpoint.
    ///
    /// Example: `client.process_someday_maybe(id)`.
    pub fn process_someday_maybe(&self, id: &str) -> Result<(), CliError> {
        self.post_empty(&format!("inbox/{id}/someday-maybe"))
    }

    /// Converts active stuff into a calendar item through the domain endpoint.
    ///
    /// Example: `client.process_calendar(id, &request)`.
    pub fn process_calendar(&self, id: &str, request: &CalendarRequest<'_>) -> Result<(), CliError> {
        self.send_json(Method::POST, &format!("inbox/{id}/calendar"), request)
    }

    /// Downloads one attachment referenced by a stuff Markdown body.
    ///
    /// Example: `client.download_stuff_asset(id, "assets/<asset-id>/file.pdf")`.
    pub fn download_stuff_asset(&self, id: &str, asset_path: &str) -> Result<Vec<u8>, CliError> {
        self.download(&format!("assets/items/{id}/{asset_path}"))
    }

    fn get_json<T: DeserializeOwned>(&self, path: &str) -> Result<T, CliError> {
        let response = self.client.get(self.url(path)?).send()?;
        Ok(Self::successful_response(response)?.json()?)
    }

    fn send_json<T: Serialize>(&self, method: Method, path: &str, body: &T) -> Result<(), CliError> {
        let response = self.client.request(method, self.url(path)?).json(body).send()?;
        Self::ensure_success(response)
    }

    fn post_empty(&self, path: &str) -> Result<(), CliError> {
        let response = self.client.post(self.url(path)?).send()?;
        Self::ensure_success(response)
    }

    fn download(&self, path: &str) -> Result<Vec<u8>, CliError> {
        let response = self.client.get(self.url(path)?).send()?;
        let response = Self::successful_response(response)?;
        Ok(response.bytes()?.to_vec())
    }

    fn url(&self, path: &str) -> Result<Url, CliError> {
        self.base_url.join(path).map_err(|_| CliError::InvalidApiUrl(self.base_url.to_string()))
    }

    fn successful_response(response: Response) -> Result<Response, CliError> {
        if response.status().is_success() { Ok(response) } else { Err(Self::api_error(response)) }
    }

    fn ensure_success(response: Response) -> Result<(), CliError> {
        Self::successful_response(response).map(|_| ())
    }

    fn api_error(response: Response) -> CliError {
        let status = response.status().as_u16();
        let message = response.text().unwrap_or_else(|_| "request failed".to_string());
        CliError::Api { status, message }
    }
}

fn ensure_trailing_slash(url: &mut Url) {
    if url.path().ends_with('/') {
        return;
    }
    let normalized_path = format!("{}/", url.path());
    url.set_path(&normalized_path);
}

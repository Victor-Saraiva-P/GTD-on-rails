package com.gtdonrails.api.persistence.bootstrap;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "gtd.persistence.bootstrap")
public class PersistenceBootstrapProperties {

    private boolean enabled = true;
    private String repositoryUrl;
    private String branch;
    private String cloneDirectory = "gtd-persistence";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getRepositoryUrl() {
        return repositoryUrl;
    }

    public void setRepositoryUrl(String repositoryUrl) {
        this.repositoryUrl = repositoryUrl;
    }

    public String getBranch() {
        return branch;
    }

    public void setBranch(String branch) {
        this.branch = branch;
    }

    public String getCloneDirectory() {
        return cloneDirectory;
    }

    public void setCloneDirectory(String cloneDirectory) {
        this.cloneDirectory = cloneDirectory;
    }
}

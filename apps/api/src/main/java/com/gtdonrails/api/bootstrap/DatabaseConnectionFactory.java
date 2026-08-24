package com.gtdonrails.api.bootstrap;

import java.sql.Connection;
import java.sql.SQLException;

@FunctionalInterface
public interface DatabaseConnectionFactory {

    Connection open(String url, String username, char[] password) throws SQLException;
}

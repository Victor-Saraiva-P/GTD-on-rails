package com.gtdonrails.api.bootstrap;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Arrays;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("bootstrap")
public class JdbcDatabaseConnectionFactory implements DatabaseConnectionFactory {

    @Override
    public Connection open(String url, String username, char[] password) throws SQLException {
        String passwordValue = new String(password);
        try {
            return DriverManager.getConnection(url, username, passwordValue);
        } finally {
            Arrays.fill(password, '\0');
        }
    }
}

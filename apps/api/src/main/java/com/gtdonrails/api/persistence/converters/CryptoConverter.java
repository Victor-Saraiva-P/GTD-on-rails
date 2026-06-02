package com.gtdonrails.api.persistence.converters;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import com.gtdonrails.api.config.GoogleProperties;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
@Converter
public class CryptoConverter implements AttributeConverter<String, String> {
    private static final String PREFIX = "gtdenc:v1:";
    private static final int IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static volatile String tokenEncryptionKey;

    @Autowired
    void configure(GoogleProperties googleProperties) {
        applyTokenEncryptionKey(googleProperties.getTokenEncryptionKey());
    }

    /**
     * Applies the current Token Encryption Key to JPA conversion.
     *
     * <p>Example: {@code CryptoConverter.applyTokenEncryptionKey(base64Key)}.</p>
     */
    public static void applyTokenEncryptionKey(String value) {
        tokenEncryptionKey = value;
    }

    /**
     * Encrypts non-empty token values before JPA writes them to storage.
     *
     * <p>Example: {@code converter.convertToDatabaseColumn("access-token")}.</p>
     */
    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (!StringUtils.hasLength(attribute)) return attribute;
        return encrypt(attribute, encryptionKeyBytes());
    }

    /**
     * Decrypts encrypted token values and leaves legacy plaintext rows readable.
     *
     * <p>Example: {@code converter.convertToEntityAttribute("legacy-token")}.</p>
     */
    @Override
    public String convertToEntityAttribute(String dbData) {
        if (!StringUtils.hasLength(dbData) || !dbData.startsWith(PREFIX)) return dbData;
        return decrypt(dbData, encryptionKeyBytes());
    }

    private String encrypt(String plaintext, byte[] keyBytes) {
        byte[] iv = randomIv();
        byte[] ciphertext = runCipher(Cipher.ENCRYPT_MODE, keyBytes, iv, plaintext.getBytes(StandardCharsets.UTF_8));
        ByteBuffer payload = ByteBuffer.allocate(iv.length + ciphertext.length).put(iv).put(ciphertext);
        return PREFIX + Base64.getEncoder().encodeToString(payload.array());
    }

    private String decrypt(String encryptedValue, byte[] keyBytes) {
        byte[] payload = Base64.getDecoder().decode(encryptedValue.substring(PREFIX.length()));
        byte[] iv = Arrays.copyOfRange(payload, 0, IV_BYTES);
        byte[] ciphertext = Arrays.copyOfRange(payload, IV_BYTES, payload.length);
        return new String(runCipher(Cipher.DECRYPT_MODE, keyBytes, iv, ciphertext), StandardCharsets.UTF_8);
    }

    private byte[] randomIv() {
        byte[] iv = new byte[IV_BYTES];
        RANDOM.nextBytes(iv);
        return iv;
    }

    private byte[] runCipher(int mode, byte[] keyBytes, byte[] iv, byte[] input) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(mode, new SecretKeySpec(keyBytes, "AES"), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return cipher.doFinal(input);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to convert encrypted value; expected AES-GCM payload", e);
        }
    }

    private byte[] encryptionKeyBytes() {
        if (!StringUtils.hasText(tokenEncryptionKey)) {
            throw new IllegalStateException("Missing gtd.google.token-encryption-key; expected Base64 AES-256 key");
        }
        return validatedKeyBytes(decodedTokenEncryptionKey());
    }

    private byte[] decodedTokenEncryptionKey() {
        try {
            return Base64.getDecoder().decode(tokenEncryptionKey);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException(
                "Invalid gtd.google.token-encryption-key value '" + tokenEncryptionKey + "'; expected Base64 AES-256 key",
                exception);
        }
    }

    private byte[] validatedKeyBytes(byte[] keyBytes) {
        if (keyBytes.length == 32) return keyBytes;
        throw new IllegalStateException(
            "Invalid gtd.google.token-encryption-key byte length " + keyBytes.length + "; expected 32 byte AES-256 key");
    }
}

package com.gtdonrails.api.config;

import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.event.service.spi.EventListenerRegistry;
import org.hibernate.event.spi.EventType;
import org.hibernate.internal.SessionFactoryImpl;
import org.springframework.stereotype.Component;

/**
 * Registers the outbox Hibernate listener for entity lifecycle events.
 *
 * <p>WHY: Hibernate event listeners cannot be registered via annotations alone;
 * they require access to the internal SessionFactory's EventListenerRegistry.</p>
 *
 * <p>Example: automatically executed on application startup.</p>
 */
@Component
public class OutboxHibernateListenerRegistrar {

    private final EntityManagerFactory entityManagerFactory;
    private final OutboxHibernateListener outboxListener;

    public OutboxHibernateListenerRegistrar(
        EntityManagerFactory entityManagerFactory,
        OutboxHibernateListener outboxListener
    ) {
        this.entityManagerFactory = entityManagerFactory;
        this.outboxListener = outboxListener;
    }

    @PostConstruct
    void registerListeners() {
        SessionFactoryImpl sessionFactory = entityManagerFactory.unwrap(SessionFactoryImpl.class);
        EventListenerRegistry registry = sessionFactory
            .getServiceRegistry()
            .getService(EventListenerRegistry.class);

        registry.appendListeners(EventType.POST_INSERT, outboxListener);
        registry.appendListeners(EventType.POST_UPDATE, outboxListener);
        registry.appendListeners(EventType.POST_DELETE, outboxListener);
    }
}

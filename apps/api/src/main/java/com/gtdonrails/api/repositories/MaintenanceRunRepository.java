package com.gtdonrails.api.repositories;

import com.gtdonrails.api.entities.MaintenanceRun;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MaintenanceRunRepository extends JpaRepository<MaintenanceRun, String> {
}

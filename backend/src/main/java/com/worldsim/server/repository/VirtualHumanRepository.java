package com.worldsim.server.repository;

import com.worldsim.server.entity.VirtualHuman;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.UUID;

@Repository
public interface VirtualHumanRepository extends JpaRepository<VirtualHuman, UUID> {
}

#!/bin/bash
psql -U coolify -d coolify -c "UPDATE \"Channel\" SET \"isFaceless\" = true WHERE \"channelType\" = 'long' AND \"isFaceless\" = false;"
psql -U coolify -d coolify -c "SELECT COUNT(*) as total_long, SUM(CASE WHEN \"isFaceless\" = true THEN 1 ELSE 0 END) as faceless_count FROM \"Channel\" WHERE \"channelType\" = 'long';"

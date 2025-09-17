// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/utils/structs/EnumerableSet.sol";

library EditableEnumLib {
    using EnumerableSet for EnumerableSet.Bytes32Set;

    struct Data {
        EnumerableSet.Bytes32Set _set;
        mapping(bytes32 => uint256) _offsetIndex; // Stores index + 1 to distinguish 0 index from non-existence
    }

    function length(Data storage self) internal view returns (uint256) {
        return self._set.length();
    }

    function at(Data storage self, uint256 index)
        internal
        view
        returns (bytes32)
    {
        return self._set.at(index);
    }

    function exists(Data storage self, bytes32 value)
        internal
        view
        returns (bool)
    {
        return self._set.contains(value);
    }

    function indexOf(Data storage self, bytes32 value)
        internal
        view
        returns (uint256)
    {
        uint256 offsetIdx = self._offsetIndex[value];
        require(offsetIdx != 0, "EditableEnum: value not present");
        return offsetIdx - 1; // Convert back to actual index
    }

    /* ---------- writes ---------- */

    function add(Data storage self, bytes32 value)
        internal
        returns (uint256 index)
    {
        require(value != bytes32(0), "EditableEnum: zero value");
        require(self._set.add(value), "EditableEnum: already present");
        index = self._set.length() - 1;
        self._offsetIndex[value] = index + 1; // Store with offset to distinguish from default 0
    }

    function remove(Data storage self, bytes32 value)
        internal
        returns (uint256 formerIndex)
    {
        formerIndex = indexOf(self, value);

        uint256 lastIdx = self._set.length() - 1;
        if (formerIndex != lastIdx) {
            // When removing from middle, the last element will be moved to this position
            bytes32 lastVal = self._set.at(lastIdx);
            self._offsetIndex[lastVal] = formerIndex + 1; // Update moved element's index
        }

        self._set.remove(value);
        delete self._offsetIndex[value]; // Clear the removed element's index
    }
}